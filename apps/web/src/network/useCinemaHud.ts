import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

const IDLE_MS = 10_000;
export function useCinemaHud(enabled: boolean, onHide: () => void) {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const manuallyHidden = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const lastActivity = useRef(Date.now());
  const pointers = useRef(new Set<number>());
  const wakePointers = useRef(new Set<number>());
  const keys = useRef(new Set<string>());
  const consumeClick = useRef(false);
  const onHideRef = useRef(onHide);
  onHideRef.current = onHide;

  const show = useCallback(() => {
    manuallyHidden.current = false;
    lastActivity.current = Date.now();
    hiddenRef.current = false;
    setHidden(false);
  }, []);

  const hide = useCallback((manual = false) => {
    if (manual) {
      manuallyHidden.current = true;
    }
    onHideRef.current();
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && root.current?.contains(focused)) focused.blur();
    hiddenRef.current = true;
    setHidden(true);
  }, []);
  useEffect(() => {
    if (!enabled) {
      show();
      return;
    }
    const timer = setInterval(() => {
      const element = root.current;
      if (!element || document.visibilityState !== 'visible') return;
      const focused = document.activeElement;
      const editing =
        focused instanceof HTMLElement &&
        element.contains(focused) &&
        focused.matches(
          'input:not([type=range]):not([type=button]):not([type=submit]),textarea,select,[contenteditable=true]',
        );
      const busy =
        pointers.current.size > 0 ||
        keys.current.size > 0 ||
        editing ||
        !!element.querySelector('[role=dialog],.cinema-invite-card');
      if (busy) {
        lastActivity.current = Date.now();
        return;
      }
      if (!hiddenRef.current && Date.now() - lastActivity.current >= IDLE_MS) hide();
    }, 500);
    return () => clearInterval(timer);
  }, [enabled, show, hide]);
  useEffect(() => {
    const release = (event: globalThis.PointerEvent) => pointers.current.delete(event.pointerId);
    const keyup = (event: globalThis.KeyboardEvent) => keys.current.delete(event.code);
    const blur = () => {
      pointers.current.clear();
      wakePointers.current.clear();
      keys.current.clear();
      lastActivity.current = Date.now();
    };
    const visible = () => {
      if (document.visibilityState === 'visible') show();
      else blur();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [show]);
  const down = (event: PointerEvent<HTMLDivElement>) => {
    lastActivity.current = Date.now();
    pointers.current.add(event.pointerId);
    if (hidden) {
      if (manuallyHidden.current) {
        // If user explicitly hid the controls via the eye button, tapping the screen shouldn't auto show/hide controls.
        // Let pointers and camera/joystick gestures function without popping HUD open.
        return;
      }
      wakePointers.current.add(event.pointerId);
      consumeClick.current = true;
      show();
      event.preventDefault();
      event.stopPropagation();
    } else consumeClick.current = false;
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    lastActivity.current = Date.now();
    pointers.current.delete(event.pointerId);
    if (wakePointers.current.delete(event.pointerId)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (wakePointers.current.has(event.pointerId)) {
      event.stopPropagation();
      return;
    }
    if (!hidden) lastActivity.current = Date.now();
  };
  const click = (event: MouseEvent<HTMLDivElement>) => {
    if (consumeClick.current) {
      consumeClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    consumeClick.current = false;
    keys.current.add(event.code);
    show();
  };
  return {
    hidden,
    show,
    hide,
    root,
    handlers: {
      onPointerDownCapture: down,
      onPointerMoveCapture: move,
      onPointerUpCapture: up,
      onPointerCancelCapture: up,
      onClickCapture: click,
      onKeyDownCapture: key,
      onFocusCapture: show,
      onWheelCapture: show,
    },
  };
}
