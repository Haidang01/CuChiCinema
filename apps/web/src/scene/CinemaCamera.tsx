import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { theaterDimensions } from './screen-projection';
import {
  clampPitch,
  firstPersonFov,
  orbitElevation,
  orbitOffset,
  screenFitDistance,
} from './camera-math';
import { sampleMotion, type RoomSnapshot } from '@cineverse/shared';
export type CameraMode = 'explore' | 'seated' | 'focus' | 'walk' | 'first';
export interface CameraRig {
  yaw: number;
  pitch: number;
  zoom: number;
  suppressUntil?: number;
}
export default function CinemaCamera({
  snapshot,
  userId,
  mode,
  clockOffset = 0,
  rig,
}: {
  snapshot: RoomSnapshot;
  userId: string;
  mode: CameraMode;
  clockOffset?: number;
  rig: MutableRefObject<CameraRig>;
}) {
  const { camera, size, invalidate } = useThree();
  const destination = useRef(new Vector3());
  const target = useRef(new Vector3());
  const orientation = useRef(new Quaternion());
  const matrix = useRef(new Matrix4());
  const initialized = useRef(false);
  const lastMode = useRef(mode);
  const me = snapshot.participants.find((person) => person.userId === userId);
  const roomShape = useMemo(() => theaterDimensions(snapshot.seats), [snapshot.seats]);
  const screen = roomShape.screen;
  const seat = snapshot.seats.find((item) => item.id === me?.seatId);
  useEffect(() => {
    invalidate();
  }, [mode, rig, size.width, size.height, me, invalidate]);
  useFrame((_, delta) => {
    const { yaw, zoom } = rig.current;
    const pitch = clampPitch(mode, rig.current.pitch);
    const aspect = size.width / Math.max(1, size.height);
    const p: [number, number, number] = me?.motion
      ? sampleMotion(me.motion, Date.now() + clockOffset).position
      : seat
        ? [seat.x, seat.y, seat.z]
        : (me?.position ?? [0, 0, 6]);
    const at = target.current;
    const dest = destination.current;
    if (mode === 'first' || mode === 'seated') {
      // Aim from this exact seat to the screen center, accounting for seat rake and side angle.
      // Avatar eye height: root is raised by the seat approach and the seated torso settles by 0.37m.
      const eye = seat ? seat.y + 1.5 : p[1] + 1.28;
      dest.set(p[0], eye, p[2] + (seat ? -0.06 : 0));
      const dx = -dest.x;
      const dz = screen.z - dest.z;
      const aimYaw = seat ? Math.atan2(dx, -dz) : 0;
      const aimPitch = seat ? Math.atan2(screen.y - eye, Math.hypot(dx, dz)) : 0;
      const viewYaw = aimYaw + yaw;
      const viewPitch = aimPitch + pitch;
      at.set(
        dest.x + Math.sin(viewYaw) * Math.cos(viewPitch) * 5,
        dest.y + Math.sin(viewPitch) * 5,
        dest.z - Math.cos(viewYaw) * Math.cos(viewPitch) * 5,
      );
    } else if (mode === 'walk') {
      // The shell cuts away when outside: zoom never sticks against an invisible wall.
      at.set(p[0], p[1] + (aspect < 1 ? 0.75 : 1.05), p[2]);
      dest.fromArray(orbitOffset(yaw, orbitElevation(mode, pitch), 5.8 * zoom)).add(at);
    } else if (mode === 'focus') {
      at.set(0, screen.y, screen.z);
      const distance =
        screenFitDistance(screen.width, screen.height, aspect, yaw, orbitElevation(mode, pitch)) *
        zoom;
      dest.fromArray(orbitOffset(yaw, orbitElevation(mode, pitch), distance)).add(at);
    } else {
      const rear = Math.max(...snapshot.seats.map((s) => s.z));
      at.set(0, roomShape.top * 0.23, rear / 2);
      const distance =
        Math.max(
          11,
          roomShape.halfWidth / aspect / Math.tan((25 * Math.PI) / 180),
          (rear + 10) * 1.2,
        ) * zoom;
      dest.fromArray(orbitOffset(yaw, orbitElevation(mode, pitch), distance)).add(at);
    }
    if (camera instanceof PerspectiveCamera) {
      const fov = mode === 'first' || mode === 'seated' ? firstPersonFov(zoom) : 50;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
    orientation.current.setFromRotationMatrix(matrix.current.lookAt(dest, at, camera.up));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const alpha =
      lastMode.current !== mode || !initialized.current || reduced
        ? 1
        : 1 - Math.exp(-12 * Math.min(delta, 0.1));
    lastMode.current = mode;
    initialized.current = true;
    camera.position.lerp(dest, alpha);
    camera.quaternion.slerp(orientation.current, alpha);
    if (
      camera.position.distanceToSquared(dest) > 0.00001 ||
      camera.quaternion.angleTo(orientation.current) > 0.001 ||
      me?.walking ||
      me?.motion
    )
      invalidate();
  });
  return null;
}
