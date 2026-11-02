import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  Film,
  UserRound,
  Armchair,
  History as HistoryIcon,
  LogOut,
  ArrowUpRight,
  Menu,
  X,
  CircleHelp,
} from 'lucide-react';
import { defaultAppearance, type Appearance, type Character, type User } from '@cineverse/shared';
import { api } from './api';
import CharacterEditor from './components/CharacterEditor';
import AuthDialog from './components/AuthDialog';
import Rooms from './components/Rooms';
import History from './components/History';
const WatchRoom = lazy(() => import('./components/WatchRoom'));
type Page = 'character' | 'rooms' | 'history';
function currentRoom() {
  return new URLSearchParams(location.search).get('room');
}
function inviteToken() {
  const room = currentRoom();
  const token = new URLSearchParams(location.hash.slice(1)).get('invite');
  if (room && token) {
    sessionStorage.setItem(`cineverse-invite:${room}`, token);
    history.replaceState(null, '', location.pathname + location.search);
  }
  return room ? (sessionStorage.getItem(`cineverse-invite:${room}`) ?? undefined) : undefined;
}
const initialToken = inviteToken();
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [name, setName] = useState('');
  const [page, setPage] = useState<Page>('character');
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(currentRoom);
  const [token, setToken] = useState<string | undefined>(initialToken);
  const notify = useCallback((message: string) => setNotice(message), []);
  const loadUser = useCallback((value: User) => {
    setUser(value);
    if (value.character) {
      setAppearance(value.character.appearance);
      setName(value.character.name);
    }
  }, []);
  useEffect(() => {
    let active = true;
    api<User | null>('/auth/me')
      .then((v) => {
        if (active && v) loadUser(v);
      })
      .catch((e) => {
        if (active) notify(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadUser, notify]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNav(false);
    };
    window.addEventListener('keydown', closeMenu);
    return () => window.removeEventListener('keydown', closeMenu);
  }, []);
  useEffect(() => {
    const change = () => {
      setRoomId(currentRoom());
      setToken(inviteToken());
    };
    window.addEventListener('popstate', change);
    return () => window.removeEventListener('popstate', change);
  }, []);
  const savedAppearance = user?.character?.appearance ?? defaultAppearance;
  const dirty =
    name !== (user?.character?.name ?? '') ||
    (Object.keys(appearance) as (keyof Appearance)[]).some(
      (key) => appearance[key] !== savedAppearance[key],
    );
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (name.trim().length < 2) {
      notify('Tên nhân vật cần ít nhất 2 ký tự.');
      return;
    }
    setBusy(true);
    try {
      const character = await api<Character>('/character', {
        method: 'PUT',
        body: JSON.stringify({ name, appearance }),
      });
      loadUser({ ...user, character });
      notify('Đã lưu nhân vật. Hẹn gặp bạn ở rạp!');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setRoomId(null);
      setPage('character');
      setName('');
      setAppearance(defaultAppearance);
      history.pushState(null, '', '/');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function navigate(next: Page) {
    if (dirty && user?.character && !window.confirm('Bạn có thay đổi chưa lưu. Rời trang này?'))
      return;
    if (!user && next !== 'character') {
      setAuthOpen(true);
      return;
    }
    if (next === 'rooms' && !user?.character) {
      notify('Hãy lưu nhân vật trước khi vào rạp.');
      return;
    }
    setPage(next);
    setMobileNav(false);
  }
  function enter(id: string, invite?: string) {
    setRoomId(id);
    setToken(invite);
    if (invite) sessionStorage.setItem(`cineverse-invite:${id}`, invite);
    history.pushState(null, '', `/?room=${encodeURIComponent(id)}`);
  }
  const nav = [
    { id: 'character' as const, label: 'Nhân vật của tôi', icon: UserRound },
    { id: 'rooms' as const, label: 'Phòng chiếu', icon: Armchair },
    { id: 'history' as const, label: 'Lịch sử', icon: HistoryIcon },
  ];
  const inRoom = !!roomId && !!user?.character;
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      {mobileNav ? (
        <button
          className="menu-overlay"
          aria-label="Đóng menu"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
      <aside inert={authOpen} className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <a className="brand" href="/" aria-label="CineVerse trang chủ">
          <span className="brand-mark">
            <Film size={25} />
          </span>
          CineVerse<span className="brand-period">.</span>
        </a>
        <p className="brand-caption">Ở gần nhau qua từng thước phim.</p>
        <button
          className="icon-button mobile-nav-close"
          aria-label="Đóng điều hướng"
          onClick={() => setMobileNav(false)}
        >
          <X size={19} />
        </button>
        <nav aria-label="Điều hướng chính">
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id && !inRoom ? 'active' : ''}
              aria-current={page === item.id && !inRoom ? 'page' : undefined}
              onClick={() => {
                if (inRoom) {
                  notify('Hãy rời phòng bằng nút Rời phòng trước.');
                  return;
                }
                navigate(item.id);
              }}
            >
              <item.icon size={19} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-invitation">
          <div className="mini-screen">
            <Film size={24} />
          </div>
          <h3>Phim hay hơn khi có nhau.</h3>
          <p>Một không gian nhỏ cho những buổi hẹn thật gần.</p>
          <button className="text-button" onClick={() => navigate('rooms')}>
            Chuẩn bị buổi phim <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="status-dot" /> Bản thử nghiệm cá nhân<span>v0.1</span>
        </div>
      </aside>
      <div inert={authOpen} className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(!mobileNav)}
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>
            <span>Không gian của bạn</span>
            <span>/</span>
            <strong>{inRoom ? 'Trong rạp' : nav.find((n) => n.id === page)?.label}</strong>
          </div>
          <div className="account">
            {user ? (
              <>
                <span className="account-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
                <span>{user.displayName}</span>
                <button
                  className="icon-button"
                  onClick={logout}
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                >
                  <LogOut size={17} />
                </button>
              </>
            ) : (
              <button className="button secondary" onClick={() => setAuthOpen(true)}>
                Đăng nhập <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {loading ? (
            <div className="empty-state">Đang mở CineVerse…</div>
          ) : inRoom ? (
            <Suspense fallback={<div className="empty-state">Đang mở phòng chiếu…</div>}>
              <WatchRoom
                user={user!}
                roomId={roomId!}
                token={token}
                notify={notify}
                onLeave={() => {
                  setRoomId(null);
                  setPage('rooms');
                  history.pushState(null, '', '/');
                }}
              />
            </Suspense>
          ) : (
            <>
              {roomId ? (
                <div className="invite-banner">
                  <Film size={20} />
                  <span>
                    Bạn được mời vào một buổi chiếu.{' '}
                    {user ? 'Lưu nhân vật để vào phòng.' : 'Đăng nhập và tạo nhân vật để tham gia.'}
                  </span>
                  {!user ? (
                    <button className="text-button" onClick={() => setAuthOpen(true)}>
                      Đăng nhập
                    </button>
                  ) : null}
                  <button
                    className="icon-button"
                    aria-label="Bỏ lời mời"
                    onClick={() => {
                      setRoomId(null);
                      history.replaceState(null, '', '/');
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : null}
              {page === 'character' ? (
                <CharacterEditor
                  user={user}
                  appearance={appearance}
                  name={name}
                  onChange={setAppearance}
                  onName={setName}
                  onSave={save}
                  onReset={() => {
                    setAppearance(user?.character?.appearance ?? defaultAppearance);
                    setName(user?.character?.name ?? '');
                  }}
                  busy={busy}
                  dirty={dirty}
                />
              ) : page === 'rooms' ? (
                <Rooms onEnter={enter} notify={notify} />
              ) : (
                <History notify={notify} />
              )}
              <footer>
                <span>
                  <Film size={14} /> CineVerse
                </span>
                <span>Mỗi buổi phim, một chút gần hơn.</span>
                <span>
                  <CircleHelp size={14} /> Không gian riêng của bạn
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {authOpen ? (
        <AuthDialog
          onClose={() => setAuthOpen(false)}
          onSuccess={(value) => {
            setAuthOpen(false);
            if (value.character) loadUser(value);
            else setUser(value);
            notify(
              value.character
                ? 'Đã khôi phục nhân vật của bạn.'
                : 'Đã đăng nhập. Hãy lưu nhân vật để bắt đầu.',
            );
          }}
        />
      ) : null}
      {notice ? (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button className="icon-button" aria-label="Đóng thông báo" onClick={() => setNotice('')}>
            <X size={17} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
