import { useCallback, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@cineverse/shared';

export function useRoomMovement(
  socket: Socket<ServerEvents, ClientEvents> | null,
  enabled: boolean,
) {
  const heading = useRef(0);
  const setHeading = useCallback((yaw: number) => {
    heading.current = yaw;
  }, []);
  const axis = useRef({ x: 0, z: 0 });
  const keys = useRef(new Set<string>());
  const sent = useRef(false);
  const setAxis = useCallback((x: number, z: number) => {
    axis.current = { x, z };
  }, []);
  const stop = useCallback(() => {
    axis.current = { x: 0, z: 0 };
    keys.current.clear();
    if (sent.current && socket?.connected) socket.emit('avatar:input', { x: 0, z: 0 });
    sent.current = false;
  }, [socket]);
  useEffect(() => {
    if (!enabled || !socket) {
      stop();
      return;
    }
    const editing = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      !!target.closest('input,textarea,select,[contenteditable=true]');
    const down = (event: KeyboardEvent) => {
      if (editing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        event.preventDefault();
        keys.current.add(key);
      }
    };
    const up = (event: KeyboardEvent) => {
      keys.current.delete(event.key.toLowerCase());
    };
    const tick = () => {
      if (!socket.connected) {
        sent.current = false;
        return;
      }
      const k = keys.current;
      let x =
        axis.current.x +
        Number(k.has('d') || k.has('arrowright')) -
        Number(k.has('a') || k.has('arrowleft'));
      let z =
        axis.current.z +
        Number(k.has('s') || k.has('arrowdown')) -
        Number(k.has('w') || k.has('arrowup'));
      const length = Math.hypot(x, z);
      if (length > 1) {
        x /= length;
        z /= length;
      }
      if (length || sent.current)
        socket.emit('avatar:input', {
          x: x * Math.cos(heading.current) - z * Math.sin(heading.current),
          z: x * Math.sin(heading.current) + z * Math.cos(heading.current),
        });
      sent.current = !!length;
    };
    const hide = () => {
      if (document.visibilityState !== 'visible') stop();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', hide);
    const interval = setInterval(tick, 80);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', hide);
      stop();
    };
  }, [socket, enabled, stop]);
  return { setAxis, stop, setHeading };
}
