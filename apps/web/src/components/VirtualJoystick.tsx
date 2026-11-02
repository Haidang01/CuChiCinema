import { useRef } from 'react';
export default function VirtualJoystick({ onAxis, disabled }: { onAxis: (x: number, z: number) => void; disabled: boolean }) {
  const stick = useRef<HTMLSpanElement>(null); const active = useRef<number | null>(null);
  const reset = () => { active.current = null; onAxis(0,0); if (stick.current) stick.current.style.transform = 'translate(0px,0px)'; };
  return <div className={`virtual-joystick ${disabled ? 'disabled' : ''}`}><button className="joystick-pad" aria-label="Joystick di chuyển. Kéo để đi, thả để dừng." disabled={disabled} onPointerDown={event => { event.preventDefault(); active.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => {
    if (active.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect(); let x = (event.clientX - rect.left - rect.width / 2) / 38; let z = (event.clientY - rect.top - rect.height / 2) / 38;
    const length = Math.hypot(x,z); if (length > 1) { x /= length; z /= length; }
    if (stick.current) stick.current.style.transform = `translate(${x * 32}px,${z * 32}px)`; onAxis(Math.abs(x) < .08 ? 0 : x, Math.abs(z) < .08 ? 0 : z);
  }} onPointerUp={reset} onPointerCancel={reset} onLostPointerCapture={reset} onBlur={reset} onKeyDown={event => { if (event.key === 'Escape') reset(); }}><span className="joystick-cross" /><span ref={stick} className="joystick-knob" /></button><small>{disabled ? 'Đứng lên để di chuyển' : 'Kéo để đi · Thả để dừng'}</small></div>;
}
