import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  Armchair,
  ArrowLeft,
  Copy,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Monitor,
  Box,
  Users,
} from 'lucide-react';
import type {
  Ack,
  ClientEvents,
  PlaybackCommand,
  RoomSnapshot,
  ServerEvents,
  User,
} from '@cineverse/shared';
import { api } from '../api';
import { useVoice } from '../voice/useVoice';
import { SceneBoundary } from './SceneBoundary';
const Cinema = lazy(() => import('../scene/Cinema'));
export default function WatchRoom({
  user,
  roomId,
  token,
  onLeave,
  notify,
}: {
  user: User;
  roomId: string;
  token?: string;
  onLeave: () => void;
  notify: (message: string) => void;
}) {
  const [socket, setSocket] = useState<Socket<ServerEvents, ClientEvents> | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState('Đang kết nối…');
  const [scene, setScene] = useState(false);
  const [source, setSource] = useState('');
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const [needsGesture, setNeedsGesture] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const clockOffset = useRef(0);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const volume = useRef(0.8);
  const voice = useVoice(socket, user.id, snapshot?.participants ?? [], notify);
  useEffect(() => {
    const connection: Socket<ServerEvents, ClientEvents> = io({ autoConnect: false });
    setSocket(connection);
    connection.on('connect', () => {
      setStatus('Đang vào phòng…');
      const start = Date.now();
      connection.emit('clock:ping', (serverTime) => {
        clockOffset.current = serverTime - (start + Date.now()) / 2;
      });
      connection.emit(
        'room:join',
        {
          roomId,
          token: token ?? sessionStorage.getItem(`cineverse-invite:${roomId}`) ?? undefined,
        },
        (result) => {
          if (result.ok) {
            setSnapshot(result.data);
            setStatus('Đã kết nối');
          } else {
            setStatus(result.error);
            notify(result.error);
          }
        },
      );
    });
    connection.on('room:snapshot', (value) => {
      setSnapshot((previous) =>
        !previous || value.playback.revision >= previous.playback.revision ? value : previous,
      );
    });
    connection.on('disconnect', () => {
      setStatus('Mất kết nối. Đang thử lại…');
      video.current?.pause();
    });
    connection.on('connect_error', (error) => setStatus(error.message));
    connection.on('session:replaced', () => {
      setStatus('Tài khoản đã mở phòng ở tab khác.');
      notify('Phiên phòng đã chuyển sang tab khác.');
    });
    connection.connect();
    return () => {
      connection.emit('room:leave');
      connection.disconnect();
      setSocket(null);
    };
  }, [roomId, token, notify]);
  useEffect(() => {
    const element = video.current;
    if (!element || !snapshot?.playback.sourceUrl) return;
    element.volume = volume.current;
    const sync = () => {
      if (status !== 'Đã kết nối') {
        element.pause();
        return;
      }
      const current = latest.current;
      if (!current || !element || element.readyState < 1) return;
      const timeline = current.playback;
      const target =
        timeline.position +
        (timeline.playing
          ? Math.max(0, Date.now() + clockOffset.current - timeline.updatedAt) / 1000
          : 0);
      const bounded = Number.isFinite(element.duration)
        ? Math.min(target, Math.max(0, element.duration - 0.05))
        : target;
      const drift = bounded - element.currentTime;
      if (Math.abs(drift) > 0.8 || (!timeline.playing && Math.abs(drift) > 0.15))
        element.currentTime = bounded;
      element.playbackRate =
        timeline.playing && Math.abs(drift) > 0.15 && Math.abs(drift) <= 0.8
          ? drift > 0
            ? 1.03
            : 0.97
          : 1;
      if (timeline.playing && element.paused && !element.ended)
        void element
          .play()
          .then(() => setNeedsGesture(false))
          .catch(() => setNeedsGesture(true));
      if (!timeline.playing && !element.paused) element.pause();
    };
    sync();
    const interval = setInterval(sync, 1500);
    element.addEventListener('loadedmetadata', sync);
    return () => {
      clearInterval(interval);
      element.removeEventListener('loadedmetadata', sync);
      element.playbackRate = 1;
    };
  }, [snapshot?.playback.sourceUrl, snapshot?.playback.revision, status]);
  const host = snapshot?.hostId === user.id;
  function ack(result: Ack<RoomSnapshot>) {
    if (result.ok) setSnapshot(result.data);
    else notify(result.error);
  }
  function command(value: PlaybackCommand) {
    if (!socket?.connected || status !== 'Đã kết nối') {
      notify('Hãy đợi kết nối phòng được khôi phục.');
      return;
    }
    socket.emit('playback:command', value, ack);
  }
  function selectSource(event: FormEvent) {
    event.preventDefault();
    setMediaError('');
    command({ action: 'source', url: source });
  }
  async function copyInvite() {
    try {
      let invite = token ?? sessionStorage.getItem(`cineverse-invite:${roomId}`);
      if (!invite) {
        const result = await api<{ token: string }>(`/rooms/${roomId}/invite`, { method: 'POST' });
        invite = result.token;
        sessionStorage.setItem(`cineverse-invite:${roomId}`, invite);
      }
      await navigator.clipboard.writeText(
        `${location.origin}/?room=${roomId}#invite=${encodeURIComponent(invite)}`,
      );
      notify('Đã sao chép link mời. Người nhận cần đăng nhập và có nhân vật.');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function leave() {
    socket?.emit('room:leave');
    socket?.disconnect();
    onLeave();
  }
  return (
    <div className="watch-room">
      <div className="room-toolbar">
        <button className="button secondary" onClick={leave}>
          <ArrowLeft size={16} /> Rời phòng
        </button>
        <span className="pill">
          <span className={`status-dot ${status !== 'Đã kết nối' ? 'offline' : ''}`} />
          {status}
        </span>
        <button className="button secondary" onClick={copyInvite} disabled={!snapshot}>
          <Copy size={16} /> Link mời
        </button>
      </div>
      <div className="page-heading">
        <div>
          <h1>{snapshot?.room.name ?? 'Phòng chiếu của bạn'}</h1>
          <p>
            <Users size={15} /> {snapshot?.participants.filter((p) => p.online).length ?? 0}/
            {snapshot?.room.maxParticipants ?? 3} người đang ở đây
          </p>
        </div>
        <button className="button secondary" onClick={() => setScene(!scene)}>
          {scene ? <Monitor size={16} /> : <Box size={16} />}
          {scene ? 'Xem 2D' : 'Sơ đồ 3D'}
        </button>
      </div>
      <div className="watch-layout">
        <section className="screen-section">
          {scene && snapshot ? (
            <SceneBoundary>
              <Suspense fallback={<p>Đang mở rạp 3D…</p>}>
                <Cinema
                  snapshot={snapshot}
                  userId={user.id}
                  onSeat={(id) =>
                    socket?.emit(
                      'seat:claim',
                      snapshot.participants.find((p) => p.userId === user.id)?.seatId === id
                        ? null
                        : id,
                      ack,
                    )
                  }
                />
              </Suspense>
            </SceneBoundary>
          ) : null}
          <div className="movie-screen">
            {snapshot?.playback.sourceUrl ? (
              <>
                <video
                  ref={video}
                  src={snapshot.playback.sourceUrl}
                  playsInline
                  preload="metadata"
                  onEnded={() => {
                    if (host) command({ action: 'pause', position: video.current?.duration ?? 0 });
                  }}
                  onLoadedMetadata={() => {
                    setDuration(video.current?.duration ?? 0);
                    setMediaError('');
                  }}
                  onTimeUpdate={() => setPosition(video.current?.currentTime ?? 0)}
                  onError={() =>
                    setMediaError(
                      'Không phát được nguồn phim. Kiểm tra URL trực tiếp, định dạng và quyền truy cập.',
                    )
                  }
                  onWaiting={() => setMediaError('Đang tải thêm dữ liệu phim…')}
                  onPlaying={() => setMediaError('')}
                />
                {needsGesture ? (
                  <button
                    className="button primary playback-unlock"
                    onClick={() => {
                      void video.current
                        ?.play()
                        .then(() => setNeedsGesture(false))
                        .catch(() =>
                          notify('Chưa phát được phim. Kiểm tra nguồn và quyền phát âm thanh.'),
                        );
                    }}
                  >
                    <Play size={17} /> Bật phát phim
                  </button>
                ) : null}
              </>
            ) : (
              <div className="screen-empty">
                <FilmMark />
                <h2>Màn hình đang chờ câu chuyện.</h2>
                <p>
                  {host
                    ? 'Thêm URL phim trực tiếp để bắt đầu buổi chiếu.'
                    : 'Chủ phòng sẽ chọn phim cho buổi chiếu.'}
                </p>
              </div>
            )}
          </div>
          {mediaError ? (
            <p className="media-status" role="status">
              {mediaError}
            </p>
          ) : null}
          <div className="playback-bar">
            <button
              className="icon-button"
              disabled={!host || !snapshot?.playback.sourceUrl}
              onClick={() =>
                command({
                  action: snapshot?.playback.playing ? 'pause' : 'play',
                  position: video.current?.currentTime ?? snapshot?.playback.position ?? 0,
                })
              }
              aria-label={snapshot?.playback.playing ? 'Tạm dừng phim' : 'Phát phim'}
            >
              {snapshot?.playback.playing ? <Pause size={21} /> : <Play size={21} />}
            </button>
            <span>
              {Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, '0')}
            </span>
            <input
              aria-label="Tua phim"
              type="range"
              min={0}
              max={Number.isFinite(duration) && duration > 0 ? duration : 1}
              step={1}
              value={Math.min(position, duration || 1)}
              disabled={!host || !duration}
              onChange={(event) =>
                command({ action: 'seek', position: Number(event.target.value) })
              }
            />
            <label className="volume-control">
              <Volume2 size={17} />
              <input
                aria-label="Âm lượng phim"
                type="range"
                min={0}
                max={1}
                step={0.05}
                defaultValue={0.8}
                onChange={(e) => {
                  volume.current = Number(e.target.value);
                  if (video.current) video.current.volume = volume.current;
                }}
              />
            </label>
          </div>
          {host ? (
            <form className="source-form" onSubmit={selectSource}>
              <label className="sr-only" htmlFor="source">
                URL phim trực tiếp
              </label>
              <input
                id="source"
                type="url"
                value={source}
                placeholder="https://…/phim.mp4"
                required
                onChange={(event) => setSource(event.target.value)}
              />
              <button className="button secondary">Chọn phim</button>
            </form>
          ) : (
            <p className="subtle">Chủ phòng điều khiển phát, dừng và tua phim.</p>
          )}
        </section>
        <aside className="room-side">
          <h2>
            <Armchair size={20} /> Chọn ghế của bạn
          </h2>
          <div className="layout-preview">
            <span>Màn hình</span>
            <div className="seat-grid">
              {snapshot?.seats.map((seat) => {
                const person = snapshot.participants.find((p) => p.seatId === seat.id);
                const mine = person?.userId === user.id;
                return (
                  <button
                    key={seat.id}
                    className={`seat-button ${person ? (mine ? 'mine' : 'occupied') : ''}`}
                    disabled={!!person && !mine}
                    onClick={() => socket?.emit('seat:claim', mine ? null : seat.id, ack)}
                    aria-label={`Ghế ${seat.id}${person ? `, ${person.name}` : ', trống'}`}
                    aria-pressed={mine}
                  >
                    <Armchair size={25} />
                    <small>{seat.id}</small>
                  </button>
                );
              })}
            </div>
            <small>Chọn ghế của mình lần nữa để đứng lên.</small>
          </div>
          <h3>Cùng xem hôm nay</h3>
          <div className="participants">
            {snapshot?.participants.map((person) => (
              <div key={person.userId}>
                <span className={`status-dot ${person.online ? '' : 'offline'}`} />
                <strong>
                  {person.name}
                  {person.userId === user.id ? ' (bạn)' : ''}
                </strong>
                <small>
                  {person.userId === snapshot.hostId ? 'Chủ phòng' : (person.seatId ?? 'Chưa ngồi')}
                </small>
              </div>
            ))}
          </div>
          <div className="voice-controls">
            <button
              className={`button ${voice.enabled ? 'primary' : 'secondary'}`}
              disabled={voice.busy || status !== 'Đã kết nối'}
              onClick={() => {
                void voice.toggleMic();
              }}
            >
              {voice.enabled ? <Mic size={17} /> : <MicOff size={17} />}
              {voice.busy ? 'Đang mở…' : voice.enabled ? 'Tắt mic' : 'Bật mic'}
            </button>
            <button
              className="icon-button"
              onClick={voice.toggleDeafen}
              aria-label={voice.deafened ? 'Bật nghe voice' : 'Tắt nghe voice'}
            >
              {voice.deafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
          <p className="subtle">
            Mic chỉ mở khi bạn cho phép. Dùng tai nghe để hạn chế tiếng vọng.
          </p>
        </aside>
      </div>
    </div>
  );
}
function FilmMark() {
  return (
    <div className="film-mark" aria-hidden="true">
      <Play size={32} strokeWidth={1.2} />
    </div>
  );
}
