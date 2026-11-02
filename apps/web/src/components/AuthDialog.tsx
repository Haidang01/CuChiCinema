import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X, ArrowRight, Film } from 'lucide-react';
import type { User } from '@cineverse/shared';
import { api } from '../api';

export default function AuthDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (user: User) => void;
}) {
  const [register, setRegister] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>('input')?.focus();
    return () => previous?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      onSuccess(
        await api<User>(register ? '/auth/register' : '/auth/login', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const elements = dialog.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input',
            );
            const first = elements?.[0],
              last = elements?.[elements.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <button className="icon-button close" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>
        <Film className="gold" size={30} />
        <h2 id="auth-title">{register ? 'Hẹn nhau ở CineVerse.' : 'Chào mừng bạn trở lại.'}</h2>
        <p>Nhân vật của bạn sẽ luôn ở đây, sẵn sàng cho buổi phim tiếp theo.</p>
        <form onSubmit={submit}>
          {register ? (
            <label>
              Tên của bạn
              <input
                name="displayName"
                autoComplete="nickname"
                minLength={2}
                maxLength={40}
                required
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              required
              maxLength={254}
            />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={10}
              maxLength={128}
              required
            />
            <small>Tối thiểu 10 ký tự.</small>
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button primary full" disabled={busy}>
            {busy ? 'Đang kết nối…' : register ? 'Tạo tài khoản' : 'Đăng nhập'}
            <ArrowRight size={17} />
          </button>
        </form>
        <button
          className="text-button"
          onClick={() => {
            setRegister(!register);
            setError('');
          }}
        >
          {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
        </button>
      </section>
    </div>
  );
}
