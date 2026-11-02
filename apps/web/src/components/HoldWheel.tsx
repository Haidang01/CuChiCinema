import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { wheelOptionAt } from './wheel-selection';
export interface WheelOption {
  id: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}
export default function HoldWheel({
  label,
  icon,
  options,
  onSelect,
  disabled = false,
  compact = false,
  onOpen,
}: {
  label: string;
  icon: ReactNode;
  options: WheelOption[];
  onSelect: (id: string) => void;
  disabled?: boolean;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const menuId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const position = useRef({ x: 0, y: 0 });
  const wheelCenter = useRef({ x: 0, y: 0 });
  const visible = useRef(false);
  const choice = useRef(-1);
  const suppressClick = useRef(false);
  const clearTimer = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  function close() {
    clearTimer();
    visible.current = false;
    active.current = null;
    choice.current = -1;
    setSelected(-1);
    setOpen(false);
  }
  function show() {
    if (disabled) return;
    clearTimer();
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = document.documentElement.clientWidth,
      height = window.innerHeight;
    const next = {
      x: Math.max(124, Math.min(width - 124, rect.left + rect.width / 2)),
      y: Math.max(134, Math.min(height - 134, rect.top + rect.height / 2)),
    };
    wheelCenter.current = next;
    setCenter(next);
    choice.current = -1;
    setSelected(-1);
    visible.current = true;
    setOpen(true);
    onOpen?.();
  }
  function pick(index: number) {
    const item = options[index];
    close();
    if (item && !item.disabled) onSelect(item.id);
    trigger.current?.focus({ preventScroll: true });
  }
  function highlight(x: number, y: number) {
    if (Math.hypot(x - origin.current.x, y - origin.current.y) < 14) {
      choice.current = -1;
      setSelected(-1);
      return;
    }
    const index = wheelOptionAt(
      x - wheelCenter.current.x,
      y - wheelCenter.current.y,
      options.length,
    );
    choice.current = index;
    setSelected(index);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (disabled) close();
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    if (active.current === null)
      document
        .getElementById(menuId)
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus({ preventScroll: true });
    const cancel = () => {
      suppressClick.current = true;
      close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancel();
        trigger.current?.focus();
      }
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`hold-wheel-trigger ${open ? 'active' : ''} ${compact ? 'compact' : ''}`}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={`Nhấn giữ ${label.toLowerCase()}, kéo rồi thả để chọn`}
        style={{ touchAction: 'none' }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.button !== 0 || active.current !== null) return;
          active.current = event.pointerId;
          origin.current = { x: event.clientX, y: event.clientY };
          position.current = origin.current;
          suppressClick.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          timer.current = setTimeout(() => {
            show();
            highlight(position.current.x, position.current.y);
          }, 220);
        }}
        onPointerMove={(event) => {
          if (active.current !== event.pointerId) return;
          position.current = { x: event.clientX, y: event.clientY };
          if (visible.current) highlight(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (active.current !== event.pointerId) return;
          clearTimer();
          if (visible.current) {
            highlight(event.clientX, event.clientY);
            suppressClick.current = true;
            const index = choice.current;
            close();
            if (index >= 0 && !options[index]?.disabled) pick(index);
          }
          active.current = null;
        }}
        onPointerCancel={() => {
          suppressClick.current = true;
          close();
        }}
        onLostPointerCapture={() => {
          if (active.current !== null) {
            suppressClick.current = true;
            close();
          }
        }}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (visible.current) close();
          else show();
        }}
      >
        {icon}
        {!compact ? <span>{label}</span> : null}
      </button>
      {open
        ? createPortal(
            <div className="quick-wheel-layer">
              <button
                className="quick-wheel-scrim"
                aria-label={`Hủy ${label.toLowerCase()}`}
                onClick={close}
              />
              <section
                id={menuId}
                role="dialog"
                aria-label={`Chọn nhanh ${label.toLowerCase()}`}
                className="quick-wheel"
                style={{ left: center.x - 120, top: center.y - 120 }}
                onContextMenu={(event) => event.preventDefault()}
              >
                <div className="quick-wheel-center" role="status">
                  <strong>{selected >= 0 ? options[selected]?.label : label}</strong>
                  <small>
                    {selected >= 0
                      ? options[selected]?.disabled
                        ? 'Đứng yên để thực hiện'
                        : 'Thả để thực hiện'
                      : 'Giữ · kéo · thả'}
                  </small>
                  <span>Về giữa để hủy</span>
                </div>
                {options.map((item, index) => {
                  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / options.length;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`quick-wheel-option ${selected === index ? 'selected' : ''}`}
                      style={{ left: 120 + Math.cos(angle) * 82, top: 120 + Math.sin(angle) * 82 }}
                      aria-label={item.label}
                      disabled={item.disabled}
                      onClick={() => pick(index)}
                    >
                      <span>{item.icon}</span>
                      <small>{item.label}</small>
                    </button>
                  );
                })}
              </section>
            </div>,
            document.querySelector('.cinema-experience') ?? document.body,
          )
        : null}
    </>
  );
}
