import { useEffect, useRef, useState } from 'react';
import type { Playback } from '@cineverse/shared';

export interface YouTubeHandle {
  playVideo(): void;
  mute(): void;
  unMute(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setVolume(volume: number): void;
  destroy(): void;
}
type YouTubeAPI = { Player: new (element: HTMLElement, options: object) => YouTubeHandle };
let apiPromise: Promise<YouTubeAPI> | undefined;
function loadAPI() {
  const target = window as Window & { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void };
  if (target.YT?.Player) return Promise.resolve(target.YT);
  if (!apiPromise)
    apiPromise = new Promise<YouTubeAPI>((resolve, reject) => {
      const previous = target.onYouTubeIframeAPIReady;
      const timeout = window.setTimeout(() => {
        apiPromise = undefined;
        reject(new Error('timeout'));
      }, 20000);
      target.onYouTubeIframeAPIReady = () => {
        previous?.();
        clearTimeout(timeout);
        resolve(target.YT!);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => {
        clearTimeout(timeout);
        apiPromise = undefined;
        reject(new Error('network'));
      };
      document.head.appendChild(script);
    });
  return apiPromise;
}

export default function YouTubePlayer(props: {
  onBlocked?: (blocked: boolean) => void;
  videoId: string;
  captions?: boolean;
  playback: Playback;
  connected: boolean;
  clockOffset: number;
  onReady: (player: YouTubeHandle | null) => void;
  onProgress: (position: number, duration: number) => void;
  onEnded: (duration: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [message, setMessage] = useState('Đang tải YouTube…');
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    props.onBlocked?.(blocked);
  }, [blocked, props.onBlocked]);
  const playerRef = useRef<YouTubeHandle | null>(null);
  const mutedFallback = useRef(false);
  const soundUnlocked = useRef(sessionStorage.getItem('cineverse-youtube-sound') === 'on');
  useEffect(() => {
    let disposed = false;
    let ready = false;
    let player: YouTubeHandle | undefined;
    const sync = () => {
      if (!ready || !player) return;
      const current = latest.current;
      if (!current.connected) {
        player.pauseVideo();
        return;
      }
      const timeline = current.playback;
      const duration = player.getDuration();
      const target =
        timeline.position +
        (timeline.playing
          ? Math.max(0, Date.now() + current.clockOffset - timeline.updatedAt) / 1000
          : 0);
      if (duration > 0 && target >= duration && player.getPlayerState() === 0) {
        current.onProgress(duration, duration);
        return;
      }
      const bounded = duration > 0 ? Math.min(target, Math.max(0, duration - 0.1)) : target;
      if (Math.abs(player.getCurrentTime() - bounded) > (timeline.playing ? 1.5 : 0.2))
        player.seekTo(bounded, true);
      if (timeline.playing) {
        if (player.getPlayerState() !== 1 && player.getPlayerState() !== 3) player.playVideo();
      } else player.pauseVideo();
      current.onProgress(player.getCurrentTime(), duration);
    };
    void loadAPI()
      .then((api) => {
        if (disposed || !container.current) return;
        const mount = document.createElement('div');
        container.current.replaceChildren(mount);
        player = new api.Player(mount, {
          videoId: props.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            origin: location.origin,
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            rel: 0,
            ...(props.captions ? { cc_load_policy: 1, cc_lang_pref: 'vi' } : {}),
          },
          events: {
            onReady: () => {
              if (disposed) return;
              ready = true;
              playerRef.current = player!;
              player!.setVolume(80);
              if (soundUnlocked.current) player!.unMute();
              else player!.mute();
              latest.current.onReady(player!);
              setMessage('');
              sync();
            },
            onAutoplayBlocked: () => {
              if (
                disposed ||
                !latest.current.connected ||
                !latest.current.playback.playing ||
                soundUnlocked.current
              )
                return;
              // Keep the shared timeline moving on mobile; each viewer can unmute once.
              mutedFallback.current = true;
              player?.mute();
              player?.playVideo();
              setBlocked(true);
            },
            onStateChange: (event: { data: number }) => {
              if (disposed) return;
              if (event.data === 1 && !mutedFallback.current) setBlocked(false);
              if (event.data === 0 && player) latest.current.onEnded(player.getDuration());
            },
            onError: (event: { data: number }) =>
              setMessage(
                [101, 150].includes(event.data)
                  ? 'Video này không cho phép nhúng. Hãy chọn video YouTube khác.'
                  : event.data === 153
                    ? 'YouTube chưa xác nhận được nguồn trang. Hãy tải lại trang bằng trình duyệt.'
                    : 'Không phát được video YouTube. Kiểm tra link và quyền truy cập video.',
              ),
          },
        });
      })
      .catch(() => {
        if (!disposed) setMessage('Không tải được YouTube. Kiểm tra Internet rồi chọn lại phim.');
      });
    const interval = window.setInterval(sync, 750);
    return () => {
      disposed = true;
      clearInterval(interval);
      latest.current.onReady(null);
      playerRef.current = null;
      player?.destroy();
    };
  }, [props.videoId]);
  return (
    <div className="youtube-player">
      <div ref={container} className="youtube-frame" />
      {message ? (
        <p className="youtube-message" role="status">
          {message}
        </p>
      ) : null}
      {blocked ? (
        <button
          className="button primary playback-unlock"
          onClick={() => {
            sessionStorage.setItem('cineverse-youtube-sound', 'on');
            soundUnlocked.current = true;
            mutedFallback.current = false;
            playerRef.current?.setVolume(100);
            playerRef.current?.unMute();
            playerRef.current?.playVideo();
            setBlocked(false);
          }}
        >
          Bật tiếng cho thiết bị này
        </button>
      ) : null}
    </div>
  );
}
