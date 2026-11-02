import { useState, type FormEvent } from 'react';
import { ArrowUp, Play, Trash2 } from 'lucide-react';
import { youtubeVideoId, type QueueCommand, type RoomSnapshot } from '@cineverse/shared';

export default function VideoQueue({
  snapshot,
  userId,
  connected,
  onQueue,
  onReplay,
  compact = false,
}: {
  snapshot: RoomSnapshot | null;
  userId: string;
  connected: boolean;
  onQueue: (command: QueueCommand, done?: (saved: boolean) => void) => void;
  onReplay: () => void;
  compact?: boolean;
}) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(!compact || !snapshot?.queue.length);
  const host = snapshot?.hostId === userId;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    onQueue({ action: 'add', url: url.trim(), title: title.trim() || undefined }, (ok) => {
      setSaving(false);
      setSaved(ok);
      if (!ok) return;
      setUrl('');
      setTitle('');
    });
  }
  return (
    <div className="video-queue">
      <details
        className="queue-add-section"
        open={adding}
        onToggle={(event) => setAdding(event.currentTarget.open)}
      >
        <summary>Thêm video YouTube</summary>
        <form className="queue-add-form" onSubmit={submit}>
          <label htmlFor="queue-url">Link YouTube hoặc video trực tiếp</label>
          <input
            id="queue-url"
            disabled={saving}
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            required
            maxLength={2048}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <label htmlFor="queue-title">Tên video (không bắt buộc)</label>
          <input
            id="queue-title"
            disabled={saving}
            maxLength={120}
            placeholder="Đặt tên để cả phòng dễ chọn"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className="button primary" disabled={!connected || saving}>
            {saving ? 'Đang lưu…' : 'Thêm vào hàng chờ'}
          </button>
        </form>
      </details>
      <p className="queue-save-status" role="status">
        {saving
          ? 'Đang lưu video vào phòng…'
          : saved
            ? 'Đã lưu vào database. Tải lại trang vẫn giữ hàng chờ.'
            : 'Hàng chờ được lưu theo phòng và khôi phục khi bạn quay lại.'}
      </p>
      <p className="subtle">
        Mọi người có thể gửi video và bình chọn. Video nhiều phiếu lên trước; chủ phòng chuyển bài.
        Hết video sẽ tự phát bài tiếp theo khi chủ phòng đang kết nối.
      </p>
      {snapshot?.playback.sourceUrl ? (
        <div className="queue-now">
          <strong>
            Đang chọn:{' '}
            {snapshot.playback.title ||
              (youtubeVideoId(snapshot.playback.sourceUrl) ? 'YouTube' : 'Video')}
          </strong>
          <a href={snapshot.playback.sourceUrl} target="_blank" rel="noreferrer">
            Mở link video hiện tại
          </a>
          {host ? (
            <button className="button secondary" disabled={!connected} onClick={onReplay}>
              Phát lại từ đầu
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="queue-heading">
        <h3>Hàng chờ · {snapshot?.queue.length ?? 0}/50</h3>
        {host ? (
          <button
            className="button secondary"
            disabled={!connected || !snapshot?.queue.length}
            onClick={() =>
              snapshot && onQueue({ action: 'next', revision: snapshot.playback.revision })
            }
          >
            <Play size={16} /> {snapshot?.playback.sourceUrl ? 'Bài tiếp theo' : 'Bắt đầu chiếu'}
          </button>
        ) : null}
      </div>
      {snapshot?.queue.length ? (
        <ol className="queue-list">
          {snapshot.queue.map((item, index) => (
            <li key={item.id}>
              <span className="queue-number">{index + 1}</span>
              <div className="queue-detail">
                <strong>{item.title}</strong>
                <small>{item.addedByName}</small>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.url}
                </a>
              </div>
              <button
                className="queue-vote"
                disabled={!connected}
                aria-label={`Ủng hộ ${item.title}`}
                aria-pressed={item.votes.includes(userId)}
                onClick={() => onQueue({ action: 'vote', id: item.id })}
              >
                <ArrowUp size={18} />
                {item.votes.length}
              </button>
              {host || item.addedBy === userId ? (
                <button
                  className="icon-button"
                  disabled={!connected}
                  aria-label={`Xóa ${item.title} khỏi hàng chờ`}
                  onClick={() => onQueue({ action: 'remove', id: item.id })}
                >
                  <Trash2 size={18} />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="subtle" role="status">
          Chưa có video. Dán link YouTube ở trên để cùng chọn bài đầu tiên.
        </p>
      )}
    </div>
  );
}
