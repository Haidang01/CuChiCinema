import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Armchair, Plus, DoorOpen, Users } from 'lucide-react';
import { generateLayout, roomSchema, type RoomRecord, type RoomConfig } from '@cineverse/shared';
import { api } from '../api';
import { estimateSightline } from '../scene/screen-projection';

export const layoutPresets = {
  standard: { label: 'Rạp tiêu chuẩn', seatsPerRow: 10, rowSpacing: 2.4, rowRise: 0.35 },
  wide: { label: 'Rạp màn ảnh rộng', seatsPerRow: 14, rowSpacing: 2.8, rowRise: 0.35 },
  intimate: { label: 'Rạp ấm cúng', seatsPerRow: 6, rowSpacing: 2.1, rowRise: 0.35 },
  luxury: { label: 'Rạp cao cấp', seatsPerRow: 8, rowSpacing: 3, rowRise: 0.38 },
} as const;
export const roomNames = {
  standard: 'Standard Cinema',
  vip: 'VIP Cinema',
  couple: 'Couple Cinema',
  lounge: 'Private Lounge',
};
const chairOptions: { id: NonNullable<RoomConfig['chairStyle']>; name: string; detail: string }[] = [
  { id: 'classic', name: 'Cổ điển', detail: 'Lưng vuông, tay vịn gỗ' },
  { id: 'recliner', name: 'Ghế ngả', detail: 'Tựa lưng nghiêng, gác chân' },
  { id: 'club', name: 'Ghế bành', detail: 'Lưng cao, đệm dày' },
  { id: 'retro', name: 'Retro', detail: 'Khung thanh mảnh, viền kim loại' },
  { id: 'pod', name: 'Pod riêng tư', detail: 'Vòm ôm quanh người ngồi' },
  { id: 'sofa', name: 'Sofa đôi', detail: 'Đệm rộng cho hai người' },
];

function ChairIllustration({ style, color }: { style: NonNullable<RoomConfig['chairStyle']>; color: string }) {
  const dark = '#252630';
  const highlight = '#ffffff55';
  return (
    <svg className={`chair-illustration chair-${style}`} viewBox="0 0 112 96" role="img" aria-label={`Hình ghế ${chairOptions.find((item) => item.id === style)?.name}`}>
      <ellipse cx="56" cy="85" rx={style === 'sofa' ? 42 : 29} ry="6" fill="#0006" />
      {style === 'pod' ? (
        <path d="M22 70V36C22 15 36 7 56 7s34 8 34 29v34H77V37c0-11-7-17-21-17S35 26 35 37v33Z" fill={color} stroke="#e6d5aa" strokeWidth="3" />
      ) : style === 'club' ? (
        <path d="M28 57V26Q28 13 40 13h32q12 0 12 13v31H73V29H39v28Z" fill={color} stroke={dark} strokeWidth="4" />
      ) : style === 'retro' ? (
        <><path d="M34 48V20q0-7 7-7h30q7 0 7 7v28Z" fill={color} stroke={dark} strokeWidth="3" /><path d="M37 20h38M41 48v17m30-17v17" stroke="#d6bd8b" strokeWidth="3" /></>
      ) : style === 'recliner' ? (
        <><path d="m34 43 5-29 33 5-5 30Z" fill={color} stroke={dark} strokeWidth="4" /><path d="m48 59 27 2 11 12-42-2Z" fill={color} stroke={dark} strokeWidth="3" /></>
      ) : style === 'sofa' ? (
        <><rect x="18" y="18" width="76" height="36" rx="11" fill={color} stroke={dark} strokeWidth="4" /><path d="M56 21v30" stroke="#fff7" strokeWidth="3" /><rect x="17" y="48" width="78" height="19" rx="8" fill={color} stroke={dark} strokeWidth="4" /></>
      ) : (
        <rect x="31" y="13" width="50" height="43" rx="8" fill={color} stroke={dark} strokeWidth="4" />
      )}
      {style !== 'sofa' && <path d="M29 49q0-5 6-5h42q6 0 6 5v14q0 6-7 6H36q-7 0-7-6Z" fill={color} stroke={dark} strokeWidth="4" />}
      <path d="M25 48v15q0 9 10 9h5m47-24v15q0 9-10 9h-5" fill="none" stroke={dark} strokeWidth={style === 'retro' ? 3 : 7} strokeLinecap="round" />
      {style !== 'retro' && <path d="M37 25h38" stroke={highlight} strokeWidth="3" strokeLinecap="round" />}
      <path d="M39 73v8m34-8v8" stroke="#c7a971" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
export default function Rooms({
  onEnter,
  notify,
}: {
  onEnter: (roomId: string, token?: string) => void;
  notify: (message: string) => void;
}) {
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [config, setConfig] = useState<RoomConfig>({
    name: 'Buổi phim của chúng mình',
    type: 'standard',
    capacity: 8,
    maxParticipants: 3,
    seatsPerRow: 10,
    rowSpacing: 2.4,
    rowRise: 0.35,
    chairStyle: 'classic',
    chairColor: '#4e3644',
    wallColor: '#20232d',
    seatOverrides: [],
  });
  const seats = useMemo(
    () => (roomSchema.safeParse(config).success ? generateLayout(config) : []),
    [config],
  );
  const sightline = useMemo(() => estimateSightline(seats), [seats]);
  const overrides = new Map((config.seatOverrides ?? []).map((item) => [item.seatId, item.kind]));
  const seatKind = (id: string, fallback: string) => overrides.get(id) ?? fallback;
  const cycleSeat = (id: string, fallback: RoomConfig['seatOverrides'][number]['kind']) => {
    const current = seatKind(id, fallback);
    const seat = seats.find((entry) => entry.id === id);
    const sameZone = seat ? seats.filter((entry) => entry.row === seat.row && entry.zone === seat.zone) : [];
    const zoneIndex = seat ? sameZone.findIndex((entry) => entry.id === id) : -1;
    const hasPartner = zoneIndex >= 0 && zoneIndex + (zoneIndex % 2 === 0 ? 1 : -1) >= 0 && zoneIndex + (zoneIndex % 2 === 0 ? 1 : -1) < sameZone.length;
    const next = current === 'standard' ? 'vip' : current === 'vip' ? hasPartner ? 'loveseat' : 'standard' : 'standard';
    const partner = seat && current === 'loveseat'
      ? sameZone[zoneIndex + (zoneIndex % 2 === 0 ? 1 : -1)]
      : undefined;
    setConfig({
      ...config,
      seatOverrides: [
        ...(config.seatOverrides ?? []).filter((entry) => entry.seatId !== id && entry.seatId !== partner?.id),
        { seatId: id, kind: next },
      ],
    });
  };
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api<RoomRecord[]>('/rooms')
      .then((v) => {
        if (active) setRooms(v);
      })
      .catch((e) => notify(e.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [notify]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ room: RoomRecord; token: string }>('/rooms', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      onEnter(result.room.id, result.token);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="section-kicker">Rạp phim riêng</span>
          <h1>Một phòng. Những người thân.</h1>
          <p>Tạo một góc xem phim dành riêng cho bạn và bạn bè.</p>
        </div>
      </div>
      <div className="rooms-layout">
        <form className="room-form" onSubmit={create}>
          <h2>Chuẩn bị buổi chiếu</h2>
          <label>
            Tên phòng
            <input
              required
              minLength={2}
              maxLength={60}
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>Không gian</legend>
            <div className="room-types">
              {Object.entries(roomNames).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={config.type === key ? 'selected' : ''}
                  aria-pressed={config.type === key}
                  onClick={() => setConfig({ ...config, type: key as RoomConfig['type'], seatOverrides: [] })}
                >
                  <Armchair size={22} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div
            className={`theater-demo ${config.type}`}
            style={{ background: config.wallColor }}
            aria-live="polite"
          >
            <div className="theater-demo-screen">MÀN HÌNH</div>
            <div className={`theater-demo-seats style-${config.chairStyle}`}>
              {Array.from({ length: 4 }, (_, row) => (
                <div className="theater-demo-row" key={row}>
                  {Array.from(
                    { length: Math.max(4, Math.min(10, Math.round(config.seatsPerRow ?? 8) / 2)) },
                    (_, seat) => (
                      <span
                        key={seat}
                        style={{ background: config.chairColor }}
                        className={
                          config.type === 'couple'
                            ? 'loveseat'
                            : row === 1 || row === 2
                              ? 'vip-seat'
                              : 'standard-seat'
                        }
                      />
                    ),
                  )}
                </div>
              ))}
            </div>
            <small>
              {roomNames[config.type]} ·{' '}
              {config.type === 'couple' ? 'Ghế đôi' : 'Ghế thường ở trước, VIP ở trung tâm'} ·{' '}
              {config.capacity} chỗ
            </small>
          </div>
          <div className="form-row">
            <label>
              Số chỗ ngồi
              <input
                type="number"
                required
                min={2}
                max={300}
                value={config.capacity}
                onChange={(e) => {
                  const capacity = Number(e.target.value);
                  setConfig({
                    ...config,
                    capacity,
                    maxParticipants: Math.min(capacity, config.maxParticipants),
                  });
                }}
              />
            </label>
            <label>
              Số người tối đa
              <input
                type="number"
                required
                min={2}
                max={config.capacity}
                value={config.maxParticipants}
                onChange={(e) => setConfig({ ...config, maxParticipants: Number(e.target.value) })}
              />
            </label>
          </div>
          <fieldset>
            <legend>Mẫu bố cục rạp</legend>
            <div className="room-types">
              {Object.entries(layoutPresets).map(([key, item]) => (
                <button
                  type="button"
                  key={key}
                  className={config.seatsPerRow === item.seatsPerRow ? 'selected' : ''}
                  aria-pressed={config.seatsPerRow === item.seatsPerRow}
                  onClick={() =>
                    setConfig({
                      ...config,
                      seatsPerRow: item.seatsPerRow,
                      rowSpacing: item.rowSpacing,
                      rowRise: item.rowRise,
                    })
                  }
                >
                  <Armchair size={22} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Chọn mẫu ghế</legend>
            <p className="chair-picker-hint">Chọn một mẫu để xem dáng ghế trong sơ đồ rạp bên dưới.</p>
            <div className="chair-style-grid">
              {chairOptions.map((option) => (
                <button
                  className={`chair-style-option ${config.chairStyle === option.id ? 'selected' : ''}`}
                  type="button"
                  key={option.id}
                  aria-pressed={config.chairStyle === option.id}
                  onClick={() => setConfig({ ...config, chairStyle: option.id })}
                >
                  <span className="chair-style-image" style={{ background: config.wallColor }}>
                    <ChairIllustration style={option.id} color={config.chairColor ?? '#4e3644'} />
                  </span>
                  <strong>{option.name}</strong>
                  <small>{option.detail}</small>
                </button>
              ))}
            </div>
            <div className="form-row">
              <label>
                Màu ghế
                <input
                  type="color"
                  value={config.chairColor ?? '#4e3644'}
                  onChange={(e) => setConfig({ ...config, chairColor: e.target.value })}
                />
              </label>
              <label>
                Màu phòng
                <input
                  type="color"
                  value={config.wallColor ?? '#20232d'}
                  onChange={(e) => setConfig({ ...config, wallColor: e.target.value })}
                />
              </label>
            </div>
          </fieldset>
          <label>
            Độ dốc ghế (độ cao mỗi hàng, mét)
            <input
              type="number"
              min={0.35}
              max={0.6}
              step={0.05}
              value={config.rowRise ?? 0.35}
              onChange={(e) => setConfig({ ...config, rowRise: Number(e.target.value) })}
            />
          </label>
          <p>
            Bậc tối thiểu 35 cm mỗi hàng để cải thiện tầm nhìn; vẫn phụ thuộc chiều cao avatar và
            góc camera.
          </p>
          {sightline ? (
            <div className={`sightline-note ${sightline.clearance >= 0.12 ? 'clear' : 'tight'}`}>
              <strong>Tầm nhìn ước tính từ hàng {sightline.rowLabel}</strong>
              <span>
                Khoảng trống qua đầu nhân vật phía trước: khoảng {Math.round(sightline.clearance * 100)} cm.
                Mục tiêu thiết kế là 12 cm.
              </span>
              {sightline.clearance < 0.12 ? (
                sightline.recommendedRise <= 0.6 ? (
                  <button type="button" onClick={() => setConfig({ ...config, rowRise: Math.ceil(sightline.recommendedRise * 100) / 100 })}>
                    Áp dụng độ dốc gợi ý: {Math.ceil(sightline.recommendedRise * 100)} cm/hàng
                  </button>
                ) : (
                  <span>Độ dốc gợi ý vượt giới hạn 60 cm; nên tăng khoảng cách hàng đầu tới màn hình hoặc giảm chiều cao ghế.</span>
                )
              ) : null}
              <small>Ước tính tia nhìn tới vùng 1/3 dưới màn hình với nhân vật 3D; camera vẫn tự căn vào tâm màn hình theo từng ghế.</small>
            </div>
          ) : null}
          <p>
            Bố cục tự tính hàng ghế: hai khu giữa ưu tiên VIP, hai khu bên là ghế thường; mẫu Couple
            tạo ghế đôi.
          </p>
          <div className="layout-preview">
            <span>Màn hình</span>
            <div
              className="seat-grid"
              style={{
                gridTemplateColumns: 'repeat(' + (config.seatsPerRow ?? 4) + ', minmax(44px, 1fr))',
                overflow: 'auto',
                maxHeight: 360,
              }}
            >
              {seats.map((seat) => {
                const kind = seatKind(seat.id, seat.kind);
                return (
                  <button
                    type="button"
                    key={seat.id}
                    className={`seat-preview kind-${kind} zone-${seat.zone}`}
                    title={`${seat.id} · ${kind === 'vip' ? 'VIP' : kind === 'loveseat' ? 'Ghế đôi' : 'Ghế thường'} · chạm để đổi loại`}
                    aria-label={`${seat.id}, ${kind === 'vip' ? 'ghế VIP' : kind === 'loveseat' ? 'ghế đôi' : 'ghế thường'}. Chạm để đổi loại.`}
                    onClick={() => cycleSeat(seat.id, seat.kind)}
                  >
                    <ChairIllustration style={config.chairStyle ?? 'classic'} color={config.chairColor ?? '#4e3644'} />
                    <small>{seat.id}</small>
                  </button>
                );
              })}
            </div>
            <div className="seat-legend" aria-label="Loại ghế">
              <span className="kind-standard">Ghế thường</span><span className="kind-vip">VIP</span><span className="kind-loveseat">Ghế đôi</span>
            </div>
            <small>
              Chạm từng ghế để đổi loại · {config.capacity} chỗ ngồi · {new Set(seats.map((s) => s.groupId)).size} cụm ghế
            </small>
          </div>
          <button className="button primary full" disabled={busy}>
            <Plus size={17} />
            {busy ? 'Đang tạo…' : 'Tạo phòng riêng'}
          </button>
        </form>
        <section className="saved-rooms">
          <h2>Phòng của bạn</h2>
          <p>Cấu hình được giữ lại cho những lần hẹn tiếp theo.</p>
          {loading ? (
            <p>Đang tải phòng…</p>
          ) : rooms.length ? (
            rooms.map((room) => (
              <article key={room.id}>
                <div className={`room-art ${room.type}`}>
                  <Armchair size={38} />
                </div>
                <div>
                  <h3>{room.name}</h3>
                  <p>{roomNames[room.type]}</p>
                  <small>
                    <Users size={13} /> {room.maxParticipants} người · {room.capacity} ghế
                  </small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => onEnter(room.id)}
                  aria-label={`Vào phòng ${room.name}`}
                >
                  <DoorOpen size={22} />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <Armchair size={40} />
              <h3>Buổi chiếu đầu tiên đang chờ.</h3>
              <p>Tạo phòng và gửi link mời cho người bạn muốn xem cùng.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
