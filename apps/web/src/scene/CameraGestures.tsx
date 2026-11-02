import { useEffect, type MutableRefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { clampPitch, clampZoom, type ViewMode } from './camera-math';
import type { CameraRig } from './CinemaCamera';
export default function CameraGestures({
  rig,
  mode,
  onHeading,
}: {
  rig: MutableRefObject<CameraRig>;
  mode: ViewMode;
  onHeading: (yaw: number) => void;
}) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const element = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let dragged = false;
    const distance = () => {
      const values = [...pointers.values()];
      return values.length === 2
        ? Math.hypot(values[0]!.x - values[1]!.x, values[0]!.y - values[1]!.y)
        : 0;
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) dragged = false;
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      const before = pointers.get(event.pointerId);
      if (!before) return;
      const previousDistance = distance();
      const dx = event.clientX - before.x,
        dy = event.clientY - before.y;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const next = distance();
        if (next > 8 && previousDistance > 8)
          rig.current.zoom = clampZoom((rig.current.zoom * previousDistance) / next);
        dragged = true;
      } else {
        rig.current.yaw -= dx * 0.005;
        rig.current.pitch = clampPitch(mode, rig.current.pitch + dy * 0.004);
        if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true;
      }
      if (dragged) rig.current.suppressUntil = performance.now() + 250;
      onHeading(rig.current.yaw);
      invalidate();
    };
    const up = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      if (element.hasPointerCapture(event.pointerId))
        element.releasePointerCapture(event.pointerId);
      if (dragged) rig.current.suppressUntil = performance.now() + 250;
    };
    const cancel = () => {
      pointers.clear();
      dragged = false;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      rig.current.zoom = clampZoom(rig.current.zoom * Math.exp(event.deltaY * 0.001));
      invalidate();
    };
    element.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', cancel);
    element.addEventListener('lostpointercapture', up);
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      element.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', cancel);
      element.removeEventListener('lostpointercapture', up);
      element.removeEventListener('wheel', wheel);
    };
  }, [gl, rig, mode, invalidate, onHeading]);
  return null;
}
