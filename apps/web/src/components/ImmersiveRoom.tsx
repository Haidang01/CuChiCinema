import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Armchair,
  ArrowLeft,
  Box,
  ChevronDown,
  ChevronUp,
  Copy,
  Film,
  Footprints,
  Heart,
  Lightbulb,
  Maximize,
  MessageCircle,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  Plus,
  Send,
  Settings,
  Smile,
  Users,
  Volume2,
  VolumeX,
  X,
  Eye,
  EyeOff,
  ListVideo,
  ImagePlus,
  Shirt,
  Music2,
} from 'lucide-react';
import type {
  ChatMessage,
  PlaybackCommand,
  QueueCommand,
  ReactionEvent,
  AvatarAction,
  AvatarActionEvent,
  RoomSnapshot,
  User,
} from '@cineverse/shared';
import { avatarActions } from '@cineverse/shared';
import HoldWheel from './HoldWheel';
import type { CameraMode, CameraRig } from '../scene/CinemaCamera';
import type { useVoice } from '../voice/useVoice';
import { SceneBoundary } from './SceneBoundary';
import MediaLibrary from './MediaLibrary';
import VirtualJoystick from './VirtualJoystick';
import { clampZoom, cameraZoom } from '../scene/camera-math';
import VideoQueue from './VideoQueue';
import RoomWardrobe from './RoomWardrobe';
import StagePanel, { DanceInvitation, type StageSender } from './StagePanel';
const Cinema = lazy(() => import('../scene/Cinema'));
type Panel =
  | 'seats'
  | 'media'
  | 'queue'
  | 'photos'
  | 'wardrobe'
  | 'stage'
  | 'chat'
  | 'people'
  | 'stage'
  | 'settings'
  | 'reactions'
  | null;
export interface ImmersiveRoomProps {
  user: User;
  snapshot: RoomSnapshot | null;
  status: string;
  view: '2d' | CameraMode;
  onView: (view: '2d' | CameraMode) => void;
  video: HTMLVideoElement | null;
  youtubeSurface: HTMLDivElement | null;
  position: number;
  duration: number;
  needsGesture: boolean;
  mediaError: string;
  hudHidden: boolean;
  onShowControls: () => void;
  onHideControls: () => void;
  onUnlock: () => void;
  onToggle: () => void;
  onCommand: (command: PlaybackCommand) => void;
  onQueue: (command: QueueCommand, done?: (saved: boolean) => void) => void;
  onReplay: () => void;
  onStage: StageSender;
  onCharacterRefresh: () => void;
  captions: boolean;
  onCaptions: (value: boolean) => void;
  onSubtitle: (file: File) => void;
  hasSubtitle: boolean;
  onClearSubtitle: () => void;
  onSeat: (id: string | null) => void;
  clockOffset: number;
  onLeave: () => void;
  onInvite: () => void;
  inviteUrl: string;
  onHideInvite: () => void;
  voice: ReturnType<typeof useVoice>;
  notify: (message: string) => void;
  onVolume: (volume: number) => void;
  setHeading: (yaw: number) => void;
  setAxis: (x: number, z: number) => void;
  stopMoving: () => void;
  onWalk: (x: number, z: number) => void;
  messages: ChatMessage[];
  onMessage: (text: string, done: () => void) => void;
  onReaction: (emoji: string) => void;
  reactions: ReactionEvent[];
  actions: AvatarActionEvent[];
  onAction: (action: AvatarAction) => void;
}

export default function ImmersiveRoom(props: ImmersiveRoomProps) {
  const { snapshot, user, status, view, onView, video, position, duration, voice, notify } = props;
  const [panel, setPanel] = useState<Panel>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const panelOpener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!panel) return;
    sheetRef.current?.querySelector<HTMLButtonElement>('.sheet-close')?.focus();
    return () => {
      panelOpener.current?.focus();
    };
  }, [panel]);
  const [chatText, setChatText] = useState('');
  const [source, setSource] = useState('');
  const [lighting, setLighting] = useState(true);
  const party=false;
  const [volume, setVolume] = useState(0.8);
  const [quality, setQuality] = useState<'smooth' | 'high'>('high');
  const rig = useRef<CameraRig>({ yaw: 0, pitch: 0, zoom: 1 });
  const [cameraRevision, setCameraRevision] = useState(0);
  const [zoom, setZoom] = useState(1);
  function changeZoom(value: number) {
    rig.current.zoom = clampZoom(value);
    setZoom(rig.current.zoom);
    setCameraRevision((n) => n + 1);
  }
  function changeView(next: '2d' | CameraMode) {
    props.stopMoving();
    rig.current.yaw = 0;
    props.setHeading(0);
    rig.current.pitch = next === 'first' || next === 'seated' ? 0.18 : 0;
    rig.current.zoom = 1;
    setZoom(1);
    setCameraRevision((n) => n + 1);
    onView(next);
  }
  function relativeAxis(x: number, z: number) {
    props.setAxis(x, z);
  }
  const chatEnd = useRef<HTMLDivElement>(null);
  const me = snapshot?.participants.find((person) => person.userId === user.id);
  const host = snapshot?.hostId === user.id;
  const connected = status === 'Đã kết nối';
  const secure = window.isSecureContext;
  const movingToSeat = !!me?.motion && me.motion.kind !== 'walk';
  const myAction = props.actions.find((action) => action.userId === user.id);
  const actionInfo = avatarActions.find((action) => action.id === myAction?.action);
  const occupied = snapshot?.participants.filter((person) => person.seatId).length ?? 0;
  useEffect(() => {
    if (panel) props.stopMoving();
  }, [panel, props.stopMoving]);
  useEffect(() => {
    if (panel === 'chat') chatEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [props.messages.length, panel]);
  const openPanel = (next: Panel) => {
    if (!panel) panelOpener.current = document.activeElement as HTMLElement | null;
    props.onShowControls();
    if (next === 'settings') setZoom(rig.current.zoom);
    setPanel((previous) => (previous === next ? null : next));
  };
  function send(event: FormEvent) {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    props.onMessage(text, () => setChatText(''));
  }
  function fullscreen() {
    const root = document.querySelector<HTMLElement>('.cinema-experience');
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (root?.requestFullscreen)
      void root.requestFullscreen().catch(() => notify('Trình duyệt chưa mở được toàn màn hình.'));
    else {
      const native = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
      if (native?.webkitEnterFullscreen) native.webkitEnterFullscreen();
      else notify('Dùng chế độ xoay ngang để xem rộng hơn trên điện thoại này.');
    }
  }
  const lastMessage = props.messages.at(-1);
  return (
    <div className={`cinema-world ${snapshot?.playback.sourceUrl ? 'has-media' : ''}`}>
      <div className={`immersive-stage ${view === '2d' ? 'native-view' : ''}`}>
        {view !== '2d' && snapshot ? (
          <SceneBoundary
            onUnavailable={() => {
              onView('2d');
              notify('Đã chuyển về 2D vì thiết bị chưa mở được rạp 3D.');
            }}
          >
            <Suspense
              fallback={
                <div className="world-loading">
                  <Film size={30} />
                  <span>Đang mở cánh cửa rạp phim…</span>
                </div>
              }
            >
              <Cinema
                cameraRevision={cameraRevision}
                onHeading={props.setHeading}
                rig={rig}
                snapshot={snapshot}
                userId={user.id}
                youtubeSurface={props.youtubeSurface}
                video={snapshot.playback.mediaId ? video : null}
                mode={view}
                clockOffset={props.clockOffset}
                onSeat={(id) => {
                  props.stopMoving();
                  props.onSeat(me?.seatId === id ? null : id);
                }}
                onFloor={(x, z) => {
                  if (me?.seatId) {
                    notify('Bấm Đứng lên trước khi đi lại.');
                    return;
                  }
                  if (view !== 'first') onView('walk');
                  props.onWalk(x, z);
                }}
                lighting={lighting}
                party={party}
                actions={props.actions}
                reactions={props.reactions}
                quality={quality}
              />
            </Suspense>
          </SceneBoundary>
        ) : !snapshot ? (
          <div className="world-loading">
            <Film size={30} />
            <span>{status}</span>
            <button className="button secondary" onClick={props.onLeave}>
              Quay về sảnh
            </button>
          </div>
        ) : null}
        {view === '2d' && !snapshot?.playback.sourceUrl ? (
          <div className="world-loading">
            <Film size={44} />
            <h2>Màn ảnh đang chờ.</h2>
            <p>
              {host
                ? 'Chọn Gửi phim để bắt đầu buổi chiếu.'
                : 'Chủ phòng sẽ chọn phim cho buổi chiếu.'}
            </p>
          </div>
        ) : null}
      </div>
      <header className="cinema-hud-header" hidden={props.hudHidden} data-watch-controls>
        <div className="cinema-wordmark">
          <span>
            <Film size={24} />
          </span>
          <div>
            <strong>CineVerse</strong>
            <small>Rạp phim của chúng mình</small>
          </div>
        </div>
        <div className="cinema-header-actions">
          <button
            className="glass-icon cinema-hide-controls"
            aria-label="Thu gọn điều khiển"
            title="Thu gọn các thanh điều khiển"
            onClick={props.onHideControls}
          >
            <EyeOff size={19} />
          </button>
          <button
            className="glass-icon"
            onClick={props.onInvite}
            disabled={!snapshot}
            aria-label="Mời bạn vào phòng"
          >
            <Copy size={19} />
          </button>
          <button
            className="cinema-profile"
            onClick={() => openPanel('people')}
            aria-label="Xem người trong phòng"
          >
            {user.character?.name.slice(0, 1).toUpperCase() ?? 'B'}
          </button>
          <button
            className="glass-icon cinema-exit"
            onClick={props.onLeave}
            aria-label="Rời rạp về sảnh"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
      </header>
      <div className="cinema-now" hidden={props.hudHidden}>
        <button className="cinema-presence" onClick={() => openPanel('people')}>
          <span className={`status-dot ${connected ? '' : 'offline'}`} />
          <span>
            {connected ? (snapshot?.playback.playing ? 'Đang chiếu' : 'Phòng riêng') : status}
          </span>
          <i />
          <Users size={15} />
          <span>{snapshot?.participants.filter((person) => person.online).length ?? 0} người</span>
          <small>
            {occupied}/{snapshot?.room.capacity ?? 0} ghế
          </small>
        </button>
        <div className="cinema-current-title">
          <small>Trên màn ảnh</small>
          <h1>
            {snapshot?.playback.title ||
              (snapshot?.playback.sourceUrl
                ? 'Buổi phim đang phát'
                : (snapshot?.room.name ?? 'CineVerse'))}
          </h1>
          <p>
            {snapshot?.playback.kind === 'image'
              ? 'Ảnh đang chiếu · chủ phòng chọn bài tiếp theo'
              : snapshot?.playback.sourceUrl
                ? `${Math.floor(position / 60)}:${String(Math.floor(position % 60)).padStart(2, '0')} / ${Number.isFinite(duration) ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '…'}`
                : 'Chạm ghế để ngồi · Chạm sàn để đi'}
          </p>
        </div>
      </div>
      <nav
        className="cinema-action-rail"
        aria-label="Chức năng trong rạp"
        hidden={props.hudHidden}
        data-watch-controls
      >
        <button className={panel === 'seats' ? 'active' : ''} onClick={() => openPanel('seats')}>
          <Armchair size={24} />
          <span>Chọn ghế</span>
        </button>
        <button className={panel === 'media' ? 'active' : ''} onClick={() => openPanel('media')}>
          <Plus size={26} />
          <span>Gửi video</span>
        </button>
        <button className={panel === 'queue' ? 'active' : ''} onClick={() => openPanel('queue')}>
          <ListVideo size={24} />
          {snapshot?.queue.length ? <b>{snapshot.queue.length}</b> : null}
          <span>Hàng chờ</span>
        </button>
        <button className={panel === 'photos' ? 'active' : ''} onClick={() => openPanel('photos')}>
          <ImagePlus size={24} />
          <span>Chiếu ảnh</span>
        </button>
        <button
          className={panel === 'wardrobe' ? 'active' : ''}
          onClick={() => openPanel('wardrobe')}
        >
          <Shirt size={24} />
          <span>Tủ đồ</span>
        </button>
        <button
          className={view === 'walk' || view === 'first' ? 'active' : ''}
          onClick={() => {
            setPanel(null);
            changeView('walk');
          }}
        >
          <Footprints size={24} />
          <span>Đi lại</span>
        </button>
        <button className={panel === 'stage' ? 'active' : ''} onClick={() => openPanel('stage')}>
          <Music2 size={24} />
          <span>Sân khấu</span>
        </button>
        <button className={panel === 'chat' ? 'active' : ''} onClick={() => openPanel('chat')}>
          <MessageCircle size={24} />
          {props.messages.length ? <b>{Math.min(99, props.messages.length)}</b> : null}
          <span>Trò chuyện</span>
        </button>
        <HoldWheel
          label="Hành động"
          icon={<span className="action-trigger-icon">👋</span>}
          disabled={!connected}
          onOpen={() => {
            setPanel(null);
            props.onShowControls();
          }}
          options={avatarActions
            .filter((action) => !action.pairedOnly)
            .map((action) => ({
              id: action.id,
              label: action.label,
              icon: action.icon,
              disabled:
                (action.standingOnly && (!!me?.seatId || !!me?.walking || movingToSeat)) ||
                (action.seatedOnly && !me?.seatId),
            }))}
          onSelect={(id) => props.onAction(id as AvatarAction)}
        />
        <HoldWheel
          label="Cảm xúc"
          icon={<Heart size={24} />}
          disabled={!connected}
          onOpen={() => {
            setPanel(null);
            props.onShowControls();
          }}
          options={['❤️', '😂', '👏', '😮', '🎉', '🍿'].map((emoji) => ({
            id: emoji,
            label: (
              {
                '❤️': 'Yêu thích',
                '😂': 'Vui quá',
                '👏': 'Vỗ tay',
                '😮': 'Bất ngờ',
                '🎉': 'Ăn mừng',
                '🍿': 'Bỏng ngô',
              } as Record<string, string>
            )[emoji]!,
            icon: emoji,
          }))}
          onSelect={props.onReaction}
        />
        <button
          className={panel === 'settings' ? 'active' : ''}
          onClick={() => openPanel('settings')}
        >
          <Settings size={23} />
          <span>Tùy chọn</span>
        </button>
      </nav>
      {(view === 'walk' || view === 'first' || view === 'explore') && !panel && !props.hudHidden ? (
        <>
          <VirtualJoystick
            disabled={!connected || !!me?.seatId || movingToSeat}
            onAxis={relativeAxis}
          />
          <div className="walking-hint">
            {me?.seatId ? (
              <button
                className="cinema-pill-button"
                disabled={movingToSeat}
                onClick={() => props.onSeat(null)}
              >
                <Footprints size={16} />
                Đứng lên
              </button>
            ) : movingToSeat ? (
              'Đang ra lối đi…'
            ) : (
              <span>
                Kéo để nhìn quanh · Chụm để zoom
                <br />
                <small>Máy tính: WASD / phím mũi tên</small>
              </span>
            )}
          </div>
        </>
      ) : null}
      {view !== '2d' && !panel && !props.hudHidden ? (
        <div className="cinema-zoom-controls" role="group" aria-label="Điều chỉnh góc nhìn">
          <button
            aria-label="Phóng to góc nhìn"
            onClick={() => changeZoom(rig.current.zoom - 0.15)}
          >
            +
          </button>
          <button
            className="camera-reset"
            aria-label="Đặt lại góc nhìn"
            onClick={() => changeView(view)}
          >
            ↺
          </button>
          <button aria-label="Thu nhỏ góc nhìn" onClick={() => changeZoom(rig.current.zoom + 0.15)}>
            −
          </button>
        </div>
      ) : null}
      {actionInfo ? (
        <div className="cinema-action-feedback" role="status">
          {actionInfo.icon} {actionInfo.label}
        </div>
      ) : null}
      <div className="cinema-reaction-floats" aria-live="polite">
        {props.reactions.map((reaction) => (
          <span key={`${reaction.userId}-${reaction.at}`}>{reaction.emoji}</span>
        ))}
      </div>
      {lastMessage && panel !== 'chat' && !props.hudHidden ? (
        <button className="cinema-chat-preview" onClick={() => openPanel('chat')}>
          <strong>{lastMessage.name}</strong>
          <span>{lastMessage.text}</span>
        </button>
      ) : null}
      <div className="cinema-bottom-hud" hidden={props.hudHidden} data-watch-controls>
        <div className="cinema-camera-row">
          <div className="cinema-camera-dock" role="group" aria-label="Góc nhìn rạp">
            <button aria-label="Toàn màn hình" onClick={fullscreen}>
              <Maximize size={20} />
            </button>
            <button
              className={view === 'explore' ? 'active' : ''}
              aria-label="Toàn cảnh rạp 3D"
              aria-pressed={view === 'explore'}
              onClick={() => changeView('explore')}
            >
              <Box size={21} />
            </button>
            <button
              className={view === 'first' ? 'active' : ''}
              aria-label="Góc nhìn thứ nhất"
              aria-pressed={view === 'first'}
              onClick={() => changeView('first')}
            >
              <span className="camera-view-label">1</span>
            </button>
            <button
              className={view === 'walk' ? 'active' : ''}
              aria-label="Góc nhìn thứ ba"
              aria-pressed={view === 'walk'}
              onClick={() => changeView('walk')}
            >
              <span className="camera-view-label">3</span>
            </button>
            <button
              className={view === 'focus' ? 'active' : ''}
              aria-label="Tập trung vào màn ảnh"
              aria-pressed={view === 'focus'}
              onClick={() => changeView('focus')}
            >
              <Eye size={21} />
            </button>
            <button
              className={view === '2d' ? 'active' : ''}
              aria-label="Xem video 2D"
              aria-pressed={view === '2d'}
              onClick={() => onView('2d')}
            >
              <Monitor size={21} />
            </button>
          </div>
          <button
            className={`cinema-mic ${voice.enabled ? 'active' : ''}`}
            aria-label={voice.enabled ? 'Tắt micro' : 'Bật micro'}
            disabled={!secure || !connected || voice.busy}
            onClick={() => {
              void voice.toggleMic();
            }}
          >
            {voice.enabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        </div>
        {snapshot?.playback.kind === 'image' ? (
          <div className="cinema-player-controls">
            <span>Ảnh đang chiếu</span>
            {host ? (
              <button
                className="button secondary"
                disabled={!connected || !snapshot.queue.length}
                onClick={() =>
                  props.onQueue({ action: 'next', revision: snapshot.playback.revision })
                }
              >
                Bài tiếp theo
              </button>
            ) : null}
          </div>
        ) : snapshot?.playback.sourceUrl ? (
          <div className="cinema-player-controls">
            <button
              disabled={!host || !connected}
              className="glass-icon"
              aria-label={snapshot.playback.playing ? 'Tạm dừng phim' : 'Phát phim'}
              onClick={props.onToggle}
            >
              {snapshot.playback.playing ? <Pause size={21} /> : <Play size={21} />}
            </button>
            <span>
              {Math.floor(position / 60)}:{String(Math.floor(position % 60)).padStart(2, '0')}
            </span>
            <input
              type="range"
              aria-label="Tua phim"
              min={0}
              max={Number.isFinite(duration) && duration > 0 ? duration : 1}
              value={Math.min(position, duration || 1)}
              step={1}
              disabled={!host || !duration}
              onChange={(event) =>
                props.onCommand({ action: 'seek', position: Number(event.target.value) })
              }
            />
            <button
              className="glass-icon"
              aria-label={volume ? 'Tắt tiếng phim' : 'Bật tiếng phim'}
              onClick={() => {
                const value = volume ? 0 : 0.8;
                setVolume(value);
                props.onVolume(value);
              }}
            >
              {volume ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
        ) : null}
        <form className="cinema-chat-composer" onSubmit={send}>
          <HoldWheel
            compact
            label="Chọn cảm xúc"
            icon={<Smile size={23} />}
            disabled={!connected}
            options={['❤️', '😂', '👏', '😮', '🎉', '🍿'].map((emoji) => ({
              id: emoji,
              label: emoji,
              icon: emoji,
            }))}
            onSelect={props.onReaction}
          />
          <input
            name="message"
            aria-label="Tin nhắn trong phòng"
            placeholder="Nói gì với cả rạp đi…"
            value={chatText}
            maxLength={280}
            autoComplete="off"
            disabled={!connected}
            onChange={(event) => setChatText(event.target.value)}
          />
          <button type="submit" disabled={!connected || !chatText.trim()} aria-label="Gửi tin nhắn">
            <Send size={22} />
          </button>
        </form>
      </div>
      {props.hudHidden ? (
        <button
          className="cinema-show-controls"
          aria-label="Hiện điều khiển"
          title="Chạm màn hình để hiện điều khiển"
          onClick={props.onShowControls}
        >
          <Eye size={17} />
          <span className="sr-only">Hiện điều khiển</span>
        </button>
      ) : null}
      {props.needsGesture ? (
        <button className="cinema-unlock" onClick={props.onUnlock}>
          <Volume2 size={18} />
          Chạm để bật phim và âm thanh
        </button>
      ) : props.mediaError ? (
        <div className="cinema-media-note" role="status">
          {props.mediaError}
          <button aria-label="Chuyển về 2D" onClick={() => onView('2d')}>
            Xem 2D
          </button>
        </div>
      ) : null}
      {props.inviteUrl ? (
        <div className="cinema-invite-card">
          <button className="sheet-close" aria-label="Đóng link mời" onClick={props.onHideInvite}>
            <X size={18} />
          </button>
          <label>
            Link mời bạn bè
            <input readOnly value={props.inviteUrl} onFocus={(event) => event.target.select()} />
          </label>
          <small>Nhấn giữ để sao chép trên điện thoại.</small>
        </div>
      ) : null}
      {snapshot && !panel ? (
        <DanceInvitation snapshot={snapshot} userId={user.id} onStage={props.onStage} />
      ) : null}
      {panel ? (
        <>
          <button
            className="cinema-sheet-scrim"
            aria-label="Đóng bảng chức năng"
            onClick={() => setPanel(null)}
          />
          <section
            ref={sheetRef}
            className="cinema-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={
              {
                seats: 'Chọn ghế',
                media: 'Chọn phim',
                queue: 'Hàng chờ video',
                photos: 'Chiếu ảnh',
                wardrobe: 'Tủ đồ',
                chat: 'Trò chuyện',
                people: 'Trong phòng',
                settings: 'Tùy chọn',
                stage: 'Sân khấu & khiêu vũ',
                reactions: 'Cảm xúc',
              }[panel]
            }
            onKeyDown={(event) => {
              if (event.key === 'Tab') {
                const focusable = [
                  ...event.currentTarget.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], summary',
                  ),
                ].filter((element) => element.getClientRects().length);
                const first = focusable[0],
                  last = focusable.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
              if (event.key === 'Escape') {
                event.stopPropagation();
                setPanel(null);
              }
            }}
          >
            <div className="sheet-handle" />
            <div className="cinema-sheet-heading">
              <h2>
                {
                  {
                    seats: 'Chọn ghế của bạn',
                    media: 'Gửi video cho cả phòng',
                    queue: 'Cùng chọn, cùng xem',
                    photos: 'Chia sẻ ảnh cùng phòng',
                    wardrobe: 'Tủ đồ của bạn',
                    chat: 'Trò chuyện trong rạp',
                    people: 'Cùng xem hôm nay',
                    settings: 'Tùy chọn của bạn',
                    stage: 'Sân khấu & khiêu vũ',
                    reactions: 'Một chút cảm xúc',
                  }[panel]
                }
              </h2>
              <button className="sheet-close" aria-label="Đóng bảng" onClick={() => setPanel(null)}>
                <X size={22} />
              </button>
            </div>
            {panel === 'seats' ? (
              <>
                <div className="layout-preview">
                  <span>Màn hình</span>
                  <div className="seat-map-rows">
                    {[
                      ...new Map((snapshot?.seats ?? []).map((seat) => [seat.row, seat])).values(),
                    ].map((rowSeat) => (
                      <div className="seat-map-row" key={rowSeat.row}>
                        <strong className="seat-row-marker">{rowSeat.rowLabel}</strong>
                        <div
                          className="seat-grid"
                          style={{
                            gridTemplateColumns: `repeat(${snapshot?.room.seatsPerRow ?? 4}, 44px)`,
                          }}
                        >
                          {(snapshot?.seats ?? [])
                            .filter((seat) => seat.row === rowSeat.row)
                            .map((seat) => {
                              const person = snapshot?.participants.find(
                                (p) => p.seatId === seat.id,
                              );
                              const mine = person?.userId === user.id;
                              return (
                                <button
                                  className={`seat-button kind-${seat.kind} zone-${seat.zone} ${mine ? 'mine' : person ? 'occupied' : 'vacant'}`}
                                  key={seat.id}
                                  disabled={movingToSeat || (!!person && !mine)}
                                  aria-label={`Hàng ${seat.rowLabel}, ghế ${seat.id}, ${seat.kind === 'vip' ? 'VIP, khu trung tâm' : seat.kind === 'loveseat' ? 'ghế đôi' : 'ghế thường'}${person ? `, ${person.name} đang ngồi` : ', còn trống'}`}
                                  aria-pressed={mine}
                                  onClick={() => {
                                    props.onSeat(mine ? null : seat.id);
                                    setPanel(null);
                                  }}
                                >
                                  <Armchair size={30} />
                                  <small>{seat.id}</small>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="seat-legend">
                    <span className="kind-standard">Ghế thường</span>
                    <span className="kind-vip">VIP</span>
                    <span className="kind-loveseat">Ghế đôi (2 chỗ)</span>
                    <span className="occupied-key">Đang có người</span>
                    <span className="vacant-key">Còn trống</span>
                  </div>
                  <p className="seat-center-note">◆ Khu trung tâm VIP · Màn hình ở phía trước</p>
                  <p>
                    {me?.seatId
                      ? `Bạn đang chọn ghế ${me.seatId}. Bấm lại ghế để đứng lên.`
                      : 'Ghế đôi có hai chỗ ngồi riêng. Chọn một ghế trống để đi tới.'}
                  </p>
                </div>
              </>
            ) : null}
            {snapshot ? (
              <DanceInvitation
                inline
                snapshot={snapshot}
                userId={user.id}
                onStage={props.onStage}
              />
            ) : null}
            {snapshot && panel === 'stage' ? (
              <StagePanel
                snapshot={snapshot}
                userId={user.id}
                connected={connected}
                onStage={(command, done) => {
                  props.stopMoving();
                  props.onStage(command, (ok) => {
                    done?.(ok);
                    if (ok && command.action === 'enter') {
                      setPanel(null);
                      changeView('walk');
                    }
                  });
                }}
                onAction={props.onAction}
                onStand={() => props.onSeat(null)}
              />
            ) : null}
            {panel === 'media' || panel === 'queue' ? (
              <>
                <VideoQueue
                  key={panel}
                  compact={panel === 'queue'}
                  snapshot={snapshot}
                  userId={user.id}
                  connected={connected}
                  onQueue={props.onQueue}
                  onReplay={props.onReplay}
                />
                {panel === 'media' ? (
                  <details className="queue-library">
                    <summary>Hoặc tải phim từ thiết bị</summary>
                    <MediaLibrary
                      selectedId={snapshot?.playback.mediaId ?? null}
                      onSelect={(id) => props.onQueue({ action: 'media', mediaId: id })}
                      notify={notify}
                    />
                  </details>
                ) : null}
                <p className="subtle">
                  Phim trong thư viện có thể chiếu lên màn hình 3D. URL ngoài dùng chế độ xem 2D khi
                  không hỗ trợ CORS.
                </p>
              </>
            ) : null}
            {panel === 'photos' ? (
              <>
                <p className="subtle">
                  Ảnh vào hàng chờ chung. Chủ phòng bấm Bài tiếp theo để chiếu ảnh; bấm lần nữa để
                  đổi sang ảnh hoặc video kế tiếp.
                </p>
                <MediaLibrary
                  imagesOnly
                  selectedId={snapshot?.playback.mediaId ?? null}
                  onSelect={(id) => props.onQueue({ action: 'media', mediaId: id })}
                  notify={notify}
                />
                <button className="button secondary" onClick={() => setPanel('queue')}>
                  Mở hàng chờ
                </button>
              </>
            ) : null}
            {panel === 'wardrobe' && me ? (
              <RoomWardrobe person={me} onRefresh={props.onCharacterRefresh} notify={notify} />
            ) : null}
            {panel === 'chat' ? (
              <>
                <div className="cinema-chat-history">
                  {props.messages.length ? (
                    props.messages.map((message) => (
                      <article key={message.id} className={message.userId === user.id ? 'own' : ''}>
                        <div>
                          <strong>{message.name}</strong>
                          <time>
                            {new Date(message.at).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                        <p>{message.text}</p>
                      </article>
                    ))
                  ) : (
                    <p>Gửi lời chào đầu tiên cho những người cùng xem.</p>
                  )}
                  <div ref={chatEnd} />
                </div>
                <form className="cinema-chat-composer in-sheet" onSubmit={send}>
                  <input
                    aria-label="Nội dung tin nhắn"
                    value={chatText}
                    onChange={(event) => setChatText(event.target.value)}
                    maxLength={280}
                    placeholder="Viết tin nhắn…"
                  />
                  <button
                    aria-label="Gửi tin nhắn trong bảng"
                    disabled={!connected || !chatText.trim()}
                  >
                    <Send size={21} />
                  </button>
                </form>
              </>
            ) : null}
            {panel === 'people' ? (
              <div className="cinema-people">
                {snapshot?.participants.map((person) => (
                  <div key={person.userId}>
                    <span className={`status-dot ${person.online ? '' : 'offline'}`} />
                    <strong>
                      {person.name}
                      {person.userId === user.id ? ' (bạn)' : ''}
                    </strong>
                    <small>
                      {person.userId === snapshot.hostId
                        ? 'Chủ phòng'
                        : person.seatId
                          ? `Ghế ${person.seatId}`
                          : 'Đang đi lại'}
                    </small>
                  </div>
                ))}
              </div>
            ) : null}
            {panel === 'reactions' ? (
              <div className="cinema-reaction-picker">
                {['❤️', '😂', '👏', '😮', '🎉', '🍿'].map((emoji) => (
                  <button
                    key={emoji}
                    aria-label={`Gửi cảm xúc ${emoji}`}
                    onClick={() => {
                      props.onReaction(emoji);
                      setPanel(null);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
            {panel === 'settings' ? (
              <div className="cinema-settings">
                <label>
                  Độ nét rạp 3D
                  <select
                    value={quality}
                    onChange={(event) => setQuality(event.target.value as 'smooth' | 'high')}
                  >
                    <option value="smooth">Mượt · ưu tiên điện thoại</option>
                    <option value="high">Cao · hình ảnh sắc nét</option>
                  </select>
                </label>
                <label>
                  Phụ đề YouTube
                  <select
                    value={props.captions ? 'vi' : 'default'}
                    onChange={(event) => props.onCaptions(event.target.value === 'vi')}
                  >
                    <option value="default">Theo thiết lập YouTube</option>
                    <option value="vi">Ưu tiên bật tiếng Việt (nếu có)</option>
                  </select>
                </label>
                <label>
                  Phụ đề cho video MP4/WebM
                  <input
                    type="file"
                    accept=".vtt,text/vtt"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) props.onSubtitle(file);
                      event.target.value = '';
                    }}
                  />
                </label>
                <p className="subtle">
                  {props.hasSubtitle ? (
                    <button className="button secondary" onClick={props.onClearSubtitle}>
                      Gỡ phụ đề VTT trên máy này
                    </button>
                  ) : null}
                  Phụ đề là tùy chọn riêng trên máy bạn. File VTT chỉ dùng cho video 2D; YouTube cần
                  video có sẵn phụ đề.
                </p>
                <label>
                  Góc nhìn
                  <select
                    aria-label="Chọn góc nhìn"
                    value={view}
                    onChange={(event) => changeView(event.target.value as CameraMode | '2d')}
                  >
                    <option value="explore">Toàn cảnh rạp</option>
                    <option value="first">Góc nhìn thứ nhất</option>
                    <option value="walk">Góc nhìn thứ ba</option>
                    <option value="seated" disabled={!me?.seatId}>
                      Từ ghế đang ngồi
                    </option>
                    <option value="focus">Màn ảnh</option>
                    <option value="2d">Video 2D</option>
                  </select>
                </label>
                <label>
                  Khoảng cách / độ rộng góc nhìn
                  <input
                    aria-label="Zoom góc nhìn"
                    type="range"
                    min={cameraZoom.min}
                    max={cameraZoom.max}
                    step=".05"
                    value={zoom}
                    onChange={(event) => changeZoom(Number(event.target.value))}
                  />
                </label>
                <button className="setting-row" onClick={props.onLeave}>
                  <ArrowLeft size={20} />
                  <span>Rời rạp về sảnh</span>
                </button>
                <button
                  className="setting-row"
                  aria-pressed={lighting}
                  onClick={() => setLighting(!lighting)}
                >
                  <Lightbulb size={20} />
                  <span>Đèn rạp</span>
                  <strong>{lighting ? 'Bật' : 'Tắt'}</strong>
                </button>
                <button
                  className="setting-row"
                  onClick={() => setPanel('stage')}
                >
                  <Smile size={20} />
                  <span>Sân khấu, đèn & khiêu vũ</span>
                  <strong>Mở</strong>
                </button>
                <label>
                  Âm lượng phim
                  <input
                    aria-label="Âm lượng phim"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setVolume(value);
                      props.onVolume(value);
                    }}
                  />
                </label>
                <button className="setting-row" onClick={voice.toggleDeafen}>
                  {voice.deafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  <span>Nghe voice</span>
                  <strong>{voice.deafened ? 'Tắt' : 'Bật'}</strong>
                </button>
                {!secure ? (
                  <p className="lan-note">
                    Micro cần HTTPS. Bạn vẫn có thể xem phim, chat và đi lại qua kết nối này.
                  </p>
                ) : (
                  <p className="subtle">
                    Voice: {voice.connections} kết nối. Micro chỉ bật khi bạn cho phép.
                  </p>
                )}
                {voice.devices.length ? (
                  <label>
                    Micro
                    <select
                      value={voice.inputId}
                      onChange={(event) => {
                        void voice.changeInput(event.target.value);
                      }}
                    >
                      {<option value="">Mặc định hệ thống</option>}
                      {voice.devices
                        .filter((device) => device.kind === 'audioinput')
                        .map((device, index) => (
                          <option key={device.deviceId || index} value={device.deviceId}>
                            {device.label || `Micro ${index + 1}`}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                <p className="subtle">
                  WASD hoặc phím mũi tên khi bật Đi lại. Chọn ghế để ngồi; đứng lên để tiếp tục di
                  chuyển.
                </p>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
