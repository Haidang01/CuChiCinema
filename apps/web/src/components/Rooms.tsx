import { useEffect, useState, type FormEvent } from 'react';
import { Armchair, Plus, DoorOpen, Users } from 'lucide-react';
import { generateLayout, type RoomRecord, type RoomConfig } from '@cineverse/shared';
import { api } from '../api';

export const roomNames = {
  standard: 'Standard Cinema',
  vip: 'VIP Cinema',
  couple: 'Couple Cinema',
  lounge: 'Private Lounge',
};
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
  });
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
                  onClick={() => setConfig({ ...config, type: key as RoomConfig['type'] })}
                >
                  <Armchair size={22} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="form-row">
            <label>
              Số chỗ ngồi
              <select
                value={config.capacity}
                onChange={(e) => {
                  const capacity = Number(e.target.value);
                  setConfig({
                    ...config,
                    capacity,
                    maxParticipants: Math.min(capacity, config.maxParticipants),
                  });
                }}
              >
                {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Số người tối đa
              <select
                value={config.maxParticipants}
                onChange={(e) => setConfig({ ...config, maxParticipants: Number(e.target.value) })}
              >
                <option value={2}>2 người</option>
                {config.capacity >= 3 ? <option value={3}>3 người</option> : null}
              </select>
            </label>
          </div>
          <div className="layout-preview">
            <span>Màn hình</span>
            <div className="seat-grid">
              {generateLayout(config).map((seat) => (
                <span key={seat.id} className="seat-preview" title={`Cụm ${seat.groupId}`}>
                  <Armchair size={24} />
                  <small>{seat.id}</small>
                </span>
              ))}
            </div>
            <small>
              {config.capacity} chỗ ngồi ·{' '}
              {new Set(generateLayout(config).map((s) => s.groupId)).size} cụm ghế
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
