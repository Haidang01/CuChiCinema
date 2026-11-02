import { useEffect, useState } from 'react';
import { History as HistoryIcon, Film, UserRound } from 'lucide-react';
import type { CharacterEvent } from '@cineverse/shared';
import { api } from '../api';
type Watch = { id: string; position: number; updatedAt: string; roomName: string };
export default function History({ notify }: { notify: (message: string) => void }) {
  const [events, setEvents] = useState<CharacterEvent[]>([]);
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    Promise.all([api<CharacterEvent[]>('/character/events'), api<Watch[]>('/history')])
      .then(([e, w]) => {
        if (active) {
          setEvents(e);
          setWatches(w);
        }
      })
      .catch((e) => notify(e.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [notify]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="section-kicker">Những dấu mốc</span>
          <h1>Câu chuyện của bạn.</h1>
          <p>Những lần đổi diện mạo và những buổi phim đã cùng nhau trải qua.</p>
        </div>
      </div>
      {loading ? (
        <p>Đang tải lịch sử…</p>
      ) : (
        <div className="history-columns">
          <section>
            <h2>
              <UserRound size={21} /> Nhật ký nhân vật
            </h2>
            {events.length ? (
              events.map((event) => (
                <article className="history-entry" key={event.id}>
                  <span className="history-dot" />
                  <div>
                    <h3>
                      {event.type === 'character_created'
                        ? 'Bắt đầu hành trình tại CineVerse'
                        : 'Thay đổi diện mạo nhân vật'}
                    </h3>
                    <time>{new Date(event.createdAt).toLocaleString('vi-VN')}</time>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <HistoryIcon size={30} />
                <p>Lưu nhân vật để tạo dấu mốc đầu tiên.</p>
              </div>
            )}
          </section>
          <section>
            <h2>
              <Film size={21} /> Lịch sử xem phim
            </h2>
            {watches.length ? (
              watches.map((watch) => (
                <article className="history-entry" key={watch.id}>
                  <Film size={20} />
                  <div>
                    <h3>{watch.roomName}</h3>
                    <p>Đã đến phút {Math.floor(watch.position / 60)}</p>
                    <time>{new Date(watch.updatedAt).toLocaleString('vi-VN')}</time>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <Film size={30} />
                <p>Những buổi xem sẽ xuất hiện tại đây.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
