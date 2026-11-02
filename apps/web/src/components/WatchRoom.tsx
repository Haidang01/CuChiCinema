import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
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
  Maximize,
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
import MediaLibrary from './MediaLibrary';
import type { CameraMode } from '../scene/CinemaCamera';
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
  const [view, setView] = useState<'2d' | CameraMode>('2d');
  const scene = view !== '2d';
  const [hudHidden, setHudHidden] = useState(false);
  const activity = useRef(Date.now());
  const [source, setSource] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const secureMedia = window.isSecureContext;
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const [needsGesture, setNeedsGesture] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const bindVideo = useCallback((node: HTMLVideoElement | null) => {
    video.current = node;
    setVideoElement(node);
  }, []);
  const clockOffset = useRef(0);
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const volume = useRef(0.8);
  const voice = useVoice(socket, user.id, snapshot?.participants ?? [], notify);
  const selectedSeat = snapshot?.participants.find((person) => person.userId === user.id)?.seatId;
  const movingToSeat = !!snapshot?.participants.find((person) => person.userId === user.id)?.motion;
  const wasMoving = useRef(false);
  useEffect(() => {
    if (wasMoving.current && !movingToSeat && selectedSeat && view === 'explore') setView('seated');
    wasMoving.current = movingToSeat;
  }, [movingToSeat, selectedSeat, view]);
  const texturePlayback = scene && !!snapshot?.playback.mediaId;
  useEffect(() => {
    if (view === 'seated' && !selectedSeat) setView('explore');
  }, [view, selectedSeat]);
  useEffect(() => {
    if (
      view !== 'focus' ||
      !snapshot?.playback.playing ||
      needsGesture ||
      status !== 'Đã kết nối'
    ) {
      setHudHidden(false);
      return;
    }
    if (hudHidden) return;
    activity.current = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      if (
        Date.now() - activity.current >= 4000 &&
        !document.activeElement?.closest('[data-watch-controls]')
      )
        setHudHidden(true);
      else timer = setTimeout(check, 1000);
    };
    timer = setTimeout(check, 4000);
    return () => clearTimeout(timer);
  }, [view, snapshot?.playback.playing, needsGesture, status, hudHidden]);
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
      let origin = location.origin;
      if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
        const config = await api<{ shareOrigin: string | null }>('/network');
        if (config.shareOrigin) origin = config.shareOrigin;
      }
      const link = `${origin}/?room=${roomId}#invite=${encodeURIComponent(invite)}`;
      setInviteUrl(link);
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(link);
          notify('Đã sao chép link mời.');
        } catch {
          notify('Chọn hoặc nhấn giữ link bên dưới để sao chép.');
        }
      } else notify('Chọn hoặc nhấn giữ link bên dưới để sao chép.');
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
    <div
      className={`watch-room ${view === 'focus' ? 'focus-mode' : ''}`}
      onPointerMove={() => {
        activity.current = Date.now();
        if (hudHidden) setHudHidden(false);
      }}
      onPointerDown={() => {
        activity.current = Date.now();
        if (hudHidden) setHudHidden(false);
      }}
      onFocusCapture={() => setHudHidden(false)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setView('2d');
          setHudHidden(false);
        }
      }}
    >
      <button
        className="button secondary hud-reveal"
        hidden={!hudHidden}
        onClick={() => setHudHidden(false)}
      >
        Hiện điều khiển
      </button>
      <div className="room-toolbar" hidden={hudHidden} data-watch-controls>
        <button
          className={`button ${voice.enabled ? 'primary' : 'secondary'}`}
          disabled={!secureMedia || voice.busy || status !== 'Đã kết nối'}
          aria-describedby={!secureMedia ? 'lan-microphone-note' : undefined}
          onClick={() => {
            void voice.toggleMic();
          }}
          aria-label={voice.enabled ? 'Tắt micro' : 'Bật micro'}
        >
          {voice.enabled ? <Mic size={16} /> : <MicOff size={16} />}
          {voice.enabled ? 'Tắt mic' : 'Bật mic'}
        </button>
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
      {!secureMedia ? (
        <p className="lan-note" id="lan-microphone-note">
          Micro cần kết nối HTTPS. Bạn vẫn có thể xem phim, chọn ghế và kiểm tra giao diện.
        </p>
      ) : null}
      {inviteUrl && !hudHidden ? (
        <div className="invite-link-panel" data-watch-controls>
          <label>
            Link mời cho điện thoại cùng mạng
            <input
              aria-label="Link mời phòng"
              value={inviteUrl}
              readOnly
              onFocus={(event) => event.target.select()}
            />
          </label>
          <button className="text-button" onClick={() => setInviteUrl('')}>
            Ẩn link
          </button>
        </div>
      ) : null}
      <div className="page-heading" hidden={hudHidden} data-watch-controls>
        <div>
          <h1>{snapshot?.room.name ?? 'Phòng chiếu của bạn'}</h1>
          <p>
            <Users size={15} /> {snapshot?.participants.filter((p) => p.online).length ?? 0}/
            {snapshot?.room.maxParticipants ?? 3} người đang ở đây
          </p>
        </div>
        <div className="view-modes" role="group" aria-label="Chế độ xem">
          <button
            className={`button secondary ${view === '2d' ? 'selected' : ''}`}
            onClick={() => setView('2d')}
            aria-pressed={view === '2d'}
          >
            <Monitor size={16} /> 2D
          </button>
          <button
            className={`button secondary ${view === 'explore' ? 'selected' : ''}`}
            onClick={() => setView('explore')}
            aria-pressed={view === 'explore'}
          >
            <Box size={16} /> Rạp 3D
          </button>
          <button
            className={`button secondary ${view === 'seated' ? 'selected' : ''}`}
            disabled={!selectedSeat}
            onClick={() => setView('seated')}
            aria-pressed={view === 'seated'}
          >
            Từ ghế
          </button>
          <button
            className={`button secondary ${view === 'focus' ? 'selected' : ''}`}
            onClick={() => setView('focus')}
            aria-pressed={view === 'focus'}
          >
            Tập trung
          </button>
        </div>
      </div>
      <div className="watch-layout">
        <section className="screen-section">
          {scene && snapshot ? (
            <SceneBoundary
              onUnavailable={() => {
                setView('2d');
                notify('Không mở được rạp 3D. Đã chuyển sang xem 2D.');
              }}
            >
              <Suspense fallback={<p>Đang mở rạp 3D…</p>}>
                <Cinema
                  snapshot={snapshot}
                  userId={user.id}
                  video={snapshot.playback.mediaId ? videoElement : null}
                  mode={view}
                  clockOffset={clockOffset.current}
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
          <div className={`movie-screen ${texturePlayback ? 'texture-source' : ''}`}>
            {snapshot?.playback.sourceUrl ? (
              <>
                <video
                  ref={bindVideo}
                  crossOrigin={snapshot.playback.mediaId ? 'anonymous' : undefined}
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
                {needsGesture && !texturePlayback ? (
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
          {needsGesture && texturePlayback ? (
            <button
              className="button primary unlock-action"
              onClick={() => {
                void video.current
                  ?.play()
                  .then(() => setNeedsGesture(false))
                  .catch(() => notify('Chưa phát được phim. Hãy kiểm tra nguồn phim.'));
              }}
            >
              <Play size={17} /> Bật phát phim và âm thanh
            </button>
          ) : null}
          {scene && snapshot?.playback.sourceUrl && !snapshot.playback.mediaId ? (
            <p className="subtle">
              Nguồn URL ngoài đang phát ở 2D. Dùng phim trong thư viện để xem trên màn hình rạp 3D.
            </p>
          ) : null}
          {mediaError ? (
            <p className="media-status" role="status">
              {mediaError}
            </p>
          ) : null}
          <div className="playback-bar" hidden={hudHidden} data-watch-controls>
            {!scene && videoElement ? (
              <button
                className="icon-button"
                aria-label="Xem phim toàn màn hình"
                onClick={() => {
                  const element = video.current as
                    | (HTMLVideoElement & { webkitEnterFullscreen?: () => void })
                    | null;
                  if (element?.requestFullscreen)
                    void element
                      .requestFullscreen()
                      .catch(() =>
                        notify('Chưa mở được toàn màn hình. Hãy thử lại sau khi phim tải xong.'),
                      );
                  else if (element?.webkitEnterFullscreen) element.webkitEnterFullscreen();
                  else notify('Trình duyệt chưa hỗ trợ chế độ toàn màn hình này.');
                }}
              >
                <Maximize size={20} />
              </button>
            ) : null}
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
          <div hidden={hudHidden} data-watch-controls>
            {host ? (
              <MediaLibrary
                onSelect={(id) => {
                  setMediaError('');
                  command({ action: 'media', mediaId: id });
                }}
                selectedId={snapshot?.playback.mediaId ?? null}
                notify={notify}
              />
            ) : null}
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
          </div>
        </section>
        <aside className="room-side" hidden={hudHidden} data-watch-controls>
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
                    disabled={movingToSeat || (!!person && !mine)}
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
            <small>
              {movingToSeat
                ? 'Nhân vật đang đi theo lối vào ghế…'
                : 'Chọn ghế của mình lần nữa để đứng lên.'}
            </small>
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
              disabled={!secureMedia || voice.busy || status !== 'Đã kết nối'}
              aria-describedby={!secureMedia ? 'lan-microphone-note' : undefined}
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
          <p className="subtle" role="status">
            Voice: {voice.connections} kết nối đang hoạt động.
          </p>
          {voice.devices.length ? (
            <div className="audio-devices">
              <label>
                Micro
                <select
                  aria-label="Chọn micro"
                  value={voice.inputId}
                  disabled={voice.busy}
                  onChange={(event) => {
                    void voice.changeInput(event.target.value);
                  }}
                >
                  <option value="">Mặc định hệ thống</option>
                  {voice.devices
                    .filter((device) => device.kind === 'audioinput')
                    .map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Micro ${index + 1}`}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Loa voice
                <select
                  aria-label="Chọn loa voice"
                  value={voice.outputId}
                  onChange={(event) => {
                    void voice.changeOutput(event.target.value);
                  }}
                >
                  <option value="">Mặc định hệ thống</option>
                  {voice.devices
                    .filter((device) => device.kind === 'audiooutput')
                    .map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Loa ${index + 1}`}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          ) : null}
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
