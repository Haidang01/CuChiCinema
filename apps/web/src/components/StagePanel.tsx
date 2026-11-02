import { useState } from 'react';
import {
  avatarActions,
  isOnStage,
  type AvatarAction,
  type DanceStyle,
  type RoomSnapshot,
  type StageCommand,
  type StageSettings,
} from '@cineverse/shared';

export type StageSender = (command: StageCommand, done?: (ok: boolean) => void) => void;
export default function StagePanel({
  snapshot,
  userId,
  connected,
  onStage,
  onAction,
  onStand,
}: {
  snapshot: RoomSnapshot;
  userId: string;
  connected: boolean;
  onStage: StageSender;
  onAction: (action: AvatarAction) => void;
  onStand: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState<DanceStyle>('waltz');
  const stage = snapshot.stage;
  const settings = stage.settings;
  const host = snapshot.hostId === userId;
  const me = snapshot.participants.find((person) => person.userId === userId);
  const paired = stage.pairs.some((pair) => pair.users.includes(userId));
  const ready = connected && !me?.seatId && !me?.walking && !me?.motion;
  const configure = (
    patch: Partial<
      Pick<StageSettings, 'enabled' | 'lighting' | 'beams' | 'fireworks' | 'intensity'>
    >,
  ) => {
    setBusy(true);
    onStage({ action: 'configure', revision: settings.revision, settings: patch }, () =>
      setBusy(false),
    );
  };
  return (
    <div className="stage-panel">
      <section className="stage-settings">
        <h3>Không khí sân khấu</h3>
        <p className="subtle">
          Hiệu ứng dùng chung cho cả phòng và được lưu lại. Chủ phòng điều chỉnh; mỗi người tự chọn
          động tác của mình.
        </p>
        {!host ? <p className="stage-note">Chỉ chủ phòng được thay đổi hiệu ứng.</p> : null}
        <fieldset disabled={!connected || !host || busy}>
          <label className="stage-toggle">
            <span>Bật sân khấu</span>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => configure({ enabled: event.target.checked })}
            />
          </label>
          <label>
            Kiểu ánh sáng
            <select
              value={settings.lighting}
              onChange={(event) =>
                configure({ lighting: event.target.value as StageSettings['lighting'] })
              }
            >
              <option value="cinema">Rạp phim · Ánh sáng dịu</option>
              <option value="bar">Quán bar · Tím và xanh</option>
              <option value="concert">Biểu diễn · Đèn sân khấu</option>
            </select>
          </label>
          <label>
            Cường độ
            <select
              value={settings.intensity}
              onChange={(event) => configure({ intensity: Number(event.target.value) })}
            >
              <option value={0.35}>Dịu</option>
              <option value={0.65}>Vừa</option>
              <option value={1}>Rực rỡ</option>
            </select>
          </label>
          <label className="stage-toggle">
            <span>Chùm đèn chuyển động</span>
            <input
              type="checkbox"
              checked={settings.beams}
              onChange={(event) => configure({ beams: event.target.checked })}
            />
          </label>
          <label className="stage-toggle">
            <span>Pháo hoa sân khấu</span>
            <input
              type="checkbox"
              checked={settings.fireworks}
              onChange={(event) => configure({ fireworks: event.target.checked })}
            />
          </label>
        </fieldset>
        <p className="subtle" role="status">
          {busy
            ? 'Đang lưu cấu hình…'
            : settings.revision
              ? 'Cấu hình đã lưu trong phòng.'
              : 'Bật sân khấu để bắt đầu.'}{' '}
          Khi bật giảm chuyển động trên thiết bị, đèn quay và pháo hoa sẽ tắt trên máy bạn.
        </p>
      </section>
      <section>
        <h3>Lên sân khấu</h3>
        {me?.seatId ? (
          <button
            className="button secondary"
            disabled={!connected || !!me.motion}
            onClick={onStand}
          >
            Đứng lên khỏi ghế
          </button>
        ) : null}
        <div className="stage-button-row">
          <button
            className="button primary"
            disabled={!ready || !settings.enabled || paired}
            onClick={() => onStage({ action: 'enter' })}
          >
            Đi lên sân khấu
          </button>
          <button
            className="button secondary"
            disabled={!ready || !isOnStage(me?.position)}
            onClick={() => onStage({ action: 'leave' })}
          >
            Rời sân khấu
          </button>
        </div>
        <p className="subtle">
          Nhân vật đi theo lối đi đến vị trí trống. Đợi đến nơi rồi chọn điệu nhảy; sân khấu có 8 vị
          trí.
        </p>
        <div className="stage-dance-grid">
          {avatarActions
            .filter((action) => action.id === 'dance' || action.id.startsWith('dance_'))
            .map((action) => (
              <button
                key={action.id}
                disabled={!ready || paired}
                onClick={() => onAction(action.id)}
              >
                <span aria-hidden="true">{action.icon}</span>
                <span>{action.label}</span>
                <small>{action.duration / 1000} giây</small>
              </button>
            ))}
        </div>
        <div className="stage-button-row">
          <button
            className="button secondary"
            disabled={!connected}
            onClick={() => onStage({ action: 'stop' })}
          >
            Dừng động tác
          </button>
          <button
            className="button secondary"
            disabled={!connected}
            onClick={() => onAction('clap')}
          >
            👏 Vỗ tay
          </button>
          <button
            className="button secondary"
            disabled={!connected}
            onClick={() => onAction('cheer')}
          >
            🙌 Hoan hô
          </button>
        </div>
      </section>
      <section>
        <h3>Khiêu vũ cùng nhau</h3>
        <p className="subtle">
          Cả hai đứng yên trên sân khấu. Người được mời có 20 giây để chấp nhận; một trong hai có
          thể dừng bất cứ lúc nào.
        </p>
        <label>
          Điệu khiêu vũ
          <select value={style} onChange={(event) => setStyle(event.target.value as DanceStyle)}>
            <option value="waltz">Waltz đôi</option>
            <option value="salsa">Salsa đôi</option>
          </select>
        </label>
        {snapshot.participants
          .filter((person) => person.userId !== userId && person.online)
          .map((person) => (
            <div className="stage-partner" key={person.userId}>
              <div>
                <strong>{person.name}</strong>
                <small>
                  {isOnStage(person.position) && !person.seatId
                    ? 'Trên sân khấu'
                    : 'Cần lên sân khấu trước'}
                </small>
              </div>
              <button
                className="button secondary"
                disabled={
                  !ready ||
                  paired ||
                  !settings.enabled ||
                  !isOnStage(me?.position) ||
                  !isOnStage(person.position) ||
                  !!person.seatId ||
                  !!person.motion ||
                  !!person.walking ||
                  stage.invites.some((invite) => [invite.from, invite.to].includes(userId))
                }
                onClick={() => onStage({ action: 'invite', to: person.userId, style })}
              >
                Mời nhảy
              </button>
            </div>
          ))}
        {stage.invites
          .filter((invite) => invite.from === userId)
          .map((invite) => (
            <p key={invite.id} className="stage-note">
              Đang đợi {snapshot.participants.find((person) => person.userId === invite.to)?.name}{' '}
              trả lời. <button onClick={() => onStage({ action: 'stop' })}>Huỷ lời mời</button>
            </p>
          ))}
      </section>
    </div>
  );
}

export function DanceInvitation({
  snapshot,
  userId,
  onStage,
  inline = false,
}: {
  snapshot: RoomSnapshot;
  userId: string;
  onStage: StageSender;
  inline?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const invite = snapshot.stage.invites.find((invite) => invite.to === userId);
  const pair = snapshot.stage.pairs.find((pair) => pair.users.includes(userId));
  if (!invite && !pair) return null;
  const respond = (accept: boolean) => {
    if (!invite) return;
    setBusy(true);
    onStage({ action: 'respond', id: invite.id, accept }, () => setBusy(false));
  };
  return (
    <aside
      className={`dance-invitation ${inline ? 'in-sheet' : ''}`}
      aria-label={pair ? 'Đang khiêu vũ' : 'Lời mời khiêu vũ'}
      role="status"
    >
      {invite ? (
        <>
          <strong>
            {snapshot.participants.find((person) => person.userId === invite.from)?.name} mời bạn
            nhảy {invite.style === 'waltz' ? 'Waltz' : 'Salsa'}
          </strong>
          <span>Lời mời có hiệu lực 20 giây.</span>
          <div>
            <button className="button primary" disabled={busy} onClick={() => respond(true)}>
              Đồng ý
            </button>
            <button className="button secondary" disabled={busy} onClick={() => respond(false)}>
              Từ chối
            </button>
          </div>
        </>
      ) : (
        <>
          <strong>
            Đang khiêu vũ cùng{' '}
            {
              snapshot.participants.find(
                (person) => pair!.users.includes(person.userId) && person.userId !== userId,
              )?.name
            }
          </strong>
          <button className="button secondary" onClick={() => onStage({ action: 'stop' })}>
            Dừng khiêu vũ
          </button>
        </>
      )}
    </aside>
  );
}
