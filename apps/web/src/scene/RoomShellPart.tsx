import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

/** A wall opens only when the orbit camera is outside that wall. */
export default function RoomShellPart({
  axis,
  boundary,
  insideLess,
  children,
}: {
  axis: 'x' | 'y' | 'z';
  boundary: number;
  insideLess: boolean;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (group.current)
      group.current.visible = insideLess
        ? camera.position[axis] < boundary - 0.12
        : camera.position[axis] > boundary + 0.12;
  });
  return <group ref={group}>{children}</group>;
}
