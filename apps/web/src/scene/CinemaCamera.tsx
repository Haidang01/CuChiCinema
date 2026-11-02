import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { RoomSnapshot } from '@cineverse/shared';
export type CameraMode = 'explore' | 'seated' | 'focus';
export default function CinemaCamera({
  snapshot,
  userId,
  mode,
}: {
  snapshot: RoomSnapshot;
  userId: string;
  mode: CameraMode;
}) {
  const { camera, size, invalidate } = useThree();
  const destination = useRef(new Vector3());
  const orientation = useRef(new Quaternion());
  const moving = useRef(false);
  const seatId = snapshot.participants.find((person) => person.userId === userId)?.seatId;
  const seat = snapshot.seats.find((item) => item.id === seatId);
  useEffect(() => {
    const look = new Vector3(0, 2.6, -5);
    let position = new Vector3(8, 7, 11);
    if (mode === 'seated' && seat) position.set(seat.x, seat.y + 1.45, seat.z + 0.15);
    else if (mode === 'focus') {
      const fov = camera instanceof PerspectiveCamera ? camera.fov : 45;
      const distance =
        (Math.max(2.7, 4.7 / (size.width / size.height)) / Math.tan((fov * Math.PI) / 360)) * 1.08;
      position.set(0, 2.6, -5 + distance);
    } else look.set(0, 0.6, -0.5);
    destination.current.copy(position);
    orientation.current.setFromRotationMatrix(new Matrix4().lookAt(position, look, camera.up));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      camera.position.copy(position);
      camera.quaternion.copy(orientation.current);
      moving.current = false;
    } else moving.current = true;
    invalidate();
  }, [camera, mode, seat?.x, seat?.y, seat?.z, size.width, size.height, invalidate]);
  useFrame((_, delta) => {
    if (!moving.current) return;
    const alpha = 1 - Math.exp(-7 * Math.min(delta, 0.1));
    camera.position.lerp(destination.current, alpha);
    camera.quaternion.slerp(orientation.current, alpha);
    if (
      camera.position.distanceToSquared(destination.current) < 0.00001 &&
      camera.quaternion.angleTo(orientation.current) < 0.001
    ) {
      camera.position.copy(destination.current);
      camera.quaternion.copy(orientation.current);
      moving.current = false;
    } else invalidate();
  });
  return null;
}
