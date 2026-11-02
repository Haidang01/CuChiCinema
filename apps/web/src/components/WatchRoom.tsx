import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  Ack,
  ClientEvents,
  PlaybackCommand,
  QueueCommand,
  StageCommand,
  RoomSnapshot,
  ServerEvents,
  User,
  ChatMessage,
  ReactionEvent,
  AvatarAction,
  AvatarActionEvent,
} from '@cineverse/shared';
import { api } from '../api';
import { youtubeVideoId } from '@cineverse/shared';
import YouTubePlayer, { type YouTubeHandle } from './YouTubePlayer';
import { useVoice } from '../voice/useVoice';
import type { CameraMode } from '../scene/CinemaCamera';
import ImmersiveRoom from './ImmersiveRoom';
import { useCinemaHud } from '../network/useCinemaHud';
import { useRoomMovement } from '../network/useRoomMovement';
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [actions, setActions] = useState<AvatarActionEvent[]>([]);
  useEffect(() => {
    if (!actions.length) return;
    const timer = setTimeout(
      () =>
        setActions((previous) =>
          previous.filter(
            (action) => Date.now() + clockOffset.current < action.at + action.duration,
          ),
        ),
      Math.max(
        30,
        Math.min(
          ...actions.map(
            (action) => action.at + action.duration - Date.now() - clockOffset.current,
          ),
        ) + 30,
      ),
    );
    return () => clearTimeout(timer);
  }, [actions]);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  useEffect(() => {
    if (!reactions.length) return;
    const timer = setTimeout(
      () =>
        setReactions((previous) => previous.filter((reaction) => Date.now() - reaction.at < 3000)),
      3100,
    );
    return () => clearTimeout(timer);
  }, [reactions]);
  const receiveSnapshot = useCallback((value: RoomSnapshot) => {
    setSnapshot((previous) => {
      if (
        previous &&
        previous.room.id === value.room.id &&
        value.playback.revision < previous.playback.revision
      )
        return previous;
      const same = previous?.room.id === value.room.id;
      const newer = same && previous.avatarRevision > value.avatarRevision;
      return {
        ...value,
        seats: same ? previous.seats : value.seats,
        avatarRevision: newer ? previous.avatarRevision : value.avatarRevision,
        participants: newer
          ? value.participants.map((person) => {
              const current = previous.participants.find((p) => p.userId === person.userId);
              return current
                ? {
                    ...person,
                    position: current.position,
                    yaw: current.yaw,
                    walking: current.walking,
                    motion: current.motion,
                  }
                : person;
            })
          : value.participants,
      };
    });
    setActions(value.actions ?? []);
    setMessages((previous) => {
      const combined = new Map(
        [...value.chat, ...previous].map((message) => [message.id, message]),
      );
      return [...combined.values()].sort((a, b) => a.at - b.at).slice(-60);
    });
  }, []);
  const [status, setStatus] = useState('Đang kết nối…');
  const [view, setView] = useState<'2d' | CameraMode>('explore');
  const scene = view !== '2d';
  const hud = useCinemaHud(!!snapshot && status === 'Đã kết nối', () => movement.stop());
  const hudHidden = hud.hidden;
  const [source, setSource] = useState('');
  const [mediaOpen, setMediaOpen] = useState(true);
  const [inviteUrl, setInviteUrl] = useState('');
  const secureMedia = window.isSecureContext;
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [mediaError, setMediaError] = useState('');
  const [captions, setCaptions] = useState(false);
  const [subtitle, setSubtitle] = useState<{ url: string; source: string } | null>(null);
  useEffect(
    () => () => {
      if (subtitle) URL.revokeObjectURL(subtitle.url);
    },
    [subtitle],
  );
  async function loadSubtitle(file: File) {
    if (file.size > 1024 * 1024 || !file.name.toLowerCase().endsWith('.vtt')) {
      notify('Chọn file phụ đề VTT tối đa 1 MB.');
      return;
    }
    const sourceUrl = latest.current?.playback.sourceUrl;
    if (!sourceUrl || youtubeVideoId(sourceUrl) || latest.current?.playback.kind === 'image') {
      notify('Chọn video MP4/WebM trước khi thêm phụ đề VTT.');
      return;
    }
    try {
      const content = await file.text();
      if (!content.trimStart().startsWith('WEBVTT')) {
        notify('File chưa đúng định dạng WebVTT.');
        return;
      }
      setSubtitle({
        url: URL.createObjectURL(new Blob([content], { type: 'text/vtt' })),
        source: sourceUrl,
      });
      setView('2d');
      notify('Đã thêm phụ đề trên máy bạn.');
    } catch {
      notify('Chưa đọc được file phụ đề.');
    }
  }
  const [needsGesture, setNeedsGesture] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [youtubeSurface, setYouTubeSurface] = useState<HTMLDivElement | null>(null);
  const [youtubeBlocked, setYouTubeBlocked] = useState(false);
  const youtube = useRef<YouTubeHandle | null>(null);
  const youtubeId = youtubeVideoId(snapshot?.playback.sourceUrl);
  useEffect(() => {
    setPosition(0);
    setDuration(0);
    setMediaError('');
    setNeedsGesture(false);
  }, [snapshot?.playback.sourceUrl]);
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
  useEffect(() => {
    setMediaOpen(!snapshot?.playback.sourceUrl);
  }, [snapshot?.playback.sourceUrl]);
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
    const connection: Socket<ServerEvents, ClientEvents> = io({ autoConnect: false });
    setSocket(connection);
    let replaced = false;
    const restoreRoom = () => {
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
            receiveSnapshot(result.data);
            setStatus('Đã kết nối');
          } else {
            setStatus(result.error);
            notify(result.error);
          }
        },
      );
    };
    connection.on('connect', restoreRoom);
    const resume = () => {
      if (document.visibilityState !== 'visible' || replaced) return;
      if (connection.connected) restoreRoom();
      // The manager already retries transport failures. A server-disconnected
      // session must be signed in again rather than stealing a replacement tab.
      else if (connection.active) connection.connect();
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    connection.on('room:snapshot', receiveSnapshot);
    connection.on('avatars:update', (update) => {
      setSnapshot((previous) => {
        if (
          !previous ||
          previous.room.id !== update.roomId ||
          update.revision <= previous.avatarRevision
        )
          return previous;
        const changes = new Map(update.participants.map((person) => [person.userId, person]));
        return {
          ...previous,
          avatarRevision: update.revision,
          participants: previous.participants.map((person) => ({
            ...person,
            ...changes.get(person.userId),
          })),
        };
      });
    });
    connection.on('chat:message', (message) =>
      setMessages((previous) =>
        previous.some((item) => item.id === message.id)
          ? previous
          : [...previous, message].slice(-60),
      ),
    );
    connection.on('avatar:action', (action) =>
      setActions((previous) =>
        [...previous.filter((item) => item.userId !== action.userId), action].slice(-300),
      ),
    );
    connection.on('reaction:play', (reaction) =>
      setReactions((previous) => [...previous, reaction].slice(-6)),
    );
    connection.on('disconnect', () => {
      setStatus('Mất kết nối. Đang thử lại…');
      video.current?.pause();
    });
    connection.on('connect_error', (error) =>
      setStatus(
        /xhr poll|websocket|timeout/i.test(error.message)
          ? 'Chưa kết nối được phòng. Đang thử lại…'
          : error.message,
      ),
    );
    connection.on('session:replaced', () => {
      replaced = true;
      setStatus('Tài khoản đã mở phòng ở tab khác.');
      notify('Phiên phòng đã chuyển sang tab khác.');
    });
    connection.connect();
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
      connection.emit('room:leave');
      connection.disconnect();
      setSocket(null);
    };
  }, [roomId, token, notify, receiveSnapshot]);
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
      if (!timeline.playing) {
        if (!element.paused) element.pause();
        setNeedsGesture(false);
      }
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
    if (result.ok) receiveSnapshot(result.data);
    else notify(result.error);
  }
  function command(value: PlaybackCommand) {
    if (!socket?.connected || status !== 'Đã kết nối') {
      notify('Hãy đợi kết nối phòng được khôi phục.');
      return;
    }
    if (value.action === 'seek' && host) {
      youtube.current?.seekTo(value.position, true);
      if (video.current) video.current.currentTime = value.position;
      setPosition(value.position);
    }
    socket.emit('playback:command', value, ack);
  }
  function queueCommand(value: QueueCommand, done?: (saved: boolean) => void) {
    if (!socket?.connected || status !== 'Đã kết nối') {
      notify('Hãy đợi kết nối phòng được khôi phục.');
      done?.(false);
      return;
    }
    socket.timeout(10000).emit('queue:command', value, (error, result) => {
      if (error) {
        notify('Chưa xác nhận được lưu hàng chờ. Giữ link và kiểm tra hàng chờ trước khi gửi lại.');
        done?.(false);
        return;
      }
      ack(result);
      if (result.ok && (value.action === 'add' || value.action === 'media'))
        notify('Đã lưu video vào hàng chờ của phòng.');
      done?.(result.ok);
    });
  }
  function stageCommand(value: StageCommand, done?: (ok: boolean) => void) {
    if (!socket?.connected || status !== 'Đã kết nối') {
      notify('Hãy đợi kết nối phòng.');
      done?.(false);
      return;
    }
    movement.stop();
    socket.timeout(10000).emit('stage:command', value, (error, result) => {
      if (error) {
        notify('Chưa nhận được phản hồi sân khấu. Hãy thử lại.');
        done?.(false);
        return;
      }
      ack(result);
      done?.(result.ok);
    });
  }
  function ended(total: number) {
    const current = latest.current;
    if (current?.hostId !== user.id || !current.playback.playing) return;
    // An iframe may report its old end event while a newer seek is taking effect.
    const expected =
      current.playback.position +
      Math.max(0, Date.now() + clockOffset.current - current.playback.updatedAt) / 1000;
    if (Number.isFinite(total) && expected < total - 1.5) return;
    if (current.queue.length) queueCommand({ action: 'next', revision: current.playback.revision });
    else command({ action: 'pause', position: Math.min(86400, total) });
  }
  function selectSource(event: FormEvent) {
    event.preventDefault();
    setMediaError('');
    command({ action: 'source', url: source });
  }
  function togglePlayback() {
    if (!host || !snapshot?.playback.sourceUrl || !socket?.connected || status !== 'Đã kết nối')
      return;
    const element = video.current;
    const playing = snapshot.playback.playing;
    if (youtube.current) {
      const player = youtube.current;
      let time = player.getCurrentTime();
      if (
        !playing &&
        player.getDuration() > 0 &&
        (player.getPlayerState() === 0 ||
          time >= player.getDuration() - 1.5 ||
          snapshot.playback.position >= player.getDuration() - 1.5)
      ) {
        time = 0;
        player.seekTo(0, true);
      }
      if (!playing) player.playVideo();
      else player.pauseVideo();
      command({ action: playing ? 'pause' : 'play', position: time });
      return;
    }
    if (!playing && element) {
      // Start in the original tap gesture: waiting for the socket round trip
      // can lose Safari's user activation and require another tap for sound.
      void element
        .play()
        .then(() => setNeedsGesture(false))
        .catch(() => setNeedsGesture(true));
    }
    command({
      action: playing ? 'pause' : 'play',
      position: element?.currentTime ?? snapshot.playback.position,
    });
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
  const me = snapshot?.participants.find((person) => person.userId === user.id);
  const movement = useRoomMovement(
    socket,
    status === 'Đã kết nối' &&
      (view === 'walk' || view === 'first' || view === 'explore') &&
      !me?.seatId &&
      !(me?.motion && me.motion.kind !== 'walk'),
  );
  function walkTo(x: number, z: number) {
    if (!socket?.connected) return;
    socket.emit('avatar:walk', { x, z }, ack);
  }
  function sendMessage(text: string, done: () => void) {
    if (!socket?.connected) {
      notify('Hãy đợi kết nối phòng.');
      return;
    }
    socket.emit('chat:send', text, (result) => {
      if (result.ok) done();
      else notify(result.error);
    });
  }
  function performAction(action: AvatarAction) {
    if (!socket?.connected) {
      notify('Hãy đợi kết nối phòng.');
      return;
    }
    socket.emit('avatar:action', action, (result) => {
      if (!result.ok) notify(result.error);
    });
  }
  function react(emoji: string) {
    socket?.emit('reaction:send', emoji, (result) => {
      if (!result.ok) notify(result.error);
    });
  }
  const unlock = () => {
    youtube.current?.unMute();
    if (!latest.current?.playback.playing) {
      setNeedsGesture(false);
      return;
    }
    void video.current
      ?.play()
      .then(() => setNeedsGesture(false))
      .catch(() => notify('Chưa bật được phim. Kiểm tra quyền âm thanh của trình duyệt.'));
  };
  return (
    <div
      ref={hud.root}
      className={`cinema-experience ${hudHidden ? 'controls-hidden' : ''}`}
      {...hud.handlers}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setView('2d');
          hud.show();
        }
      }}
    >
      {snapshot?.playback.kind === 'image' && snapshot.playback.sourceUrl ? (
        view === '2d' ? (
          <img
            className={`cinema-shared-image ${view === '2d' ? 'is-visible' : 'is-floating'}`}
            src={snapshot.playback.sourceUrl}
            alt={snapshot.playback.title || 'Ảnh đang chiếu trong phòng'}
            onError={() =>
              setMediaError('Chưa tải được ảnh. Hãy kiểm tra kết nối hoặc chọn lại ảnh.')
            }
            onLoad={() => setMediaError('')}
          />
        ) : null
      ) : youtubeId && snapshot ? (
        <div
          ref={setYouTubeSurface}
          className={
            view === '2d' ? 'cinema-youtube-source is-visible' : 'cinema-youtube-source is-screen'
          }
        >
          <div className="cinema-screen-object">
            <YouTubePlayer
              onBlocked={setYouTubeBlocked}
              key={`${youtubeId}:${captions}`}
              captions={captions}
              videoId={youtubeId}
              playback={snapshot.playback}
              connected={status === 'Đã kết nối'}
              clockOffset={clockOffset.current}
              onReady={(player) => {
                youtube.current = player;
                if (player) player.setVolume(volume.current * 100);
              }}
              onProgress={(time, total) => {
                setPosition(time);
                setDuration(total);
              }}
              onEnded={ended}
            />
          </div>
        </div>
      ) : snapshot?.playback.sourceUrl ? (
        <video
          className={view === '2d' ? 'cinema-native-source is-visible' : 'cinema-native-source'}
          ref={bindVideo}
          crossOrigin={snapshot.playback.mediaId ? 'anonymous' : undefined}
          src={snapshot.playback.sourceUrl}
          playsInline
          autoPlay
          muted={false}
          preload="auto"
          onEnded={() => {
            ended(video.current?.duration ?? 0);
          }}
          onLoadedMetadata={() => {
            setDuration(video.current?.duration ?? 0);
            setMediaError('');
          }}
          onTimeUpdate={() => setPosition(video.current?.currentTime ?? 0)}
          onError={() =>
            setMediaError('Không phát được phim. Kiểm tra định dạng hoặc chuyển về 2D.')
          }
          onWaiting={() => setMediaError('Đang tải thêm dữ liệu phim…')}
          onPlaying={() => setMediaError('')}
        >
          {subtitle?.source === snapshot.playback.sourceUrl ? (
            <track
              key={subtitle.url}
              kind="subtitles"
              src={subtitle.url}
              srcLang="vi"
              label="Phụ đề của bạn"
              default
              onLoad={(event) => {
                const track = event.currentTarget.track;
                track.mode = 'showing';
                // Keep captions above the room controls in portrait and landscape.
                for (const cue of Array.from(track.cues ?? [])) {
                  if (cue instanceof VTTCue) {
                    cue.snapToLines = false;
                    cue.line = 60;
                  }
                }
              }}
              onError={() => notify('Chưa tải được phụ đề. Kiểm tra file VTT và chọn lại.')}
            />
          ) : null}
        </video>
      ) : null}
      {youtubeId && youtubeBlocked && view !== '2d' ? (
        <button
          className="cinema-unlock youtube-screen-unlock"
          onClick={() => {
            sessionStorage.setItem('cineverse-youtube-sound', 'on');
            youtube.current?.setVolume(100);
            youtube.current?.unMute();
            youtube.current?.playVideo();
            setYouTubeBlocked(false);
          }}
        >
          Bật tiếng cho thiết bị này
        </button>
      ) : null}
      <ImmersiveRoom
        user={user}
        snapshot={snapshot}
        status={status}
        view={view}
        onView={setView}
        video={videoElement}
        position={position}
        duration={duration}
        needsGesture={needsGesture}
        mediaError={mediaError}
        onHideControls={() => hud.hide(true)}
        hudHidden={hudHidden}
        onShowControls={() => hud.show()}
        onUnlock={unlock}
        onToggle={togglePlayback}
        onCommand={command}
        onQueue={queueCommand}
        onStage={stageCommand}
        onReplay={() => {
          if (snapshot?.playback.sourceUrl && host) command({ action: 'play', position: 0 });
        }}
        onCharacterRefresh={() => socket?.emit('character:refresh', ack)}
        captions={captions}
        onCaptions={setCaptions}
        hasSubtitle={!!subtitle && subtitle.source === snapshot?.playback.sourceUrl}
        onClearSubtitle={() => setSubtitle(null)}
        onSubtitle={(file) => {
          void loadSubtitle(file);
        }}
        onSeat={(id) => {
          movement.stop();
          socket?.emit('seat:claim', id, ack);
        }}
        clockOffset={clockOffset.current}
        onLeave={leave}
        onInvite={() => {
          void copyInvite();
        }}
        inviteUrl={inviteUrl}
        onHideInvite={() => setInviteUrl('')}
        voice={voice}
        notify={notify}
        onVolume={(value) => {
          volume.current = value;
          if (video.current) video.current.volume = value;
          if (youtube.current) {
            youtube.current.setVolume(value * 100);
            if (value > 0) {
              sessionStorage.setItem('cineverse-youtube-sound', 'on');
              youtube.current.unMute();
              if (snapshot?.playback.playing) youtube.current.playVideo();
            } else youtube.current.mute();
          }
        }}
        setHeading={movement.setHeading}
        setAxis={movement.setAxis}
        stopMoving={movement.stop}
        onWalk={walkTo}
        messages={messages}
        onMessage={sendMessage}
        onReaction={react}
        youtubeSurface={youtubeId ? youtubeSurface : null}
        actions={actions}
        onAction={performAction}
        reactions={reactions}
      />
    </div>
  );
}
