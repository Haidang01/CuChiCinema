import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { sampleMotion, type Participant, type Seat } from '@cineverse/shared';
import type { Group } from 'three';
import Avatar from './Avatar';

export default function AvatarActor({
  person,
  seats,
  index,
  clockOffset,
  hidden,
}: {
  person: Participant;
  seats: Seat[];
  index: number;
  clockOffset: number;
  hidden: boolean;
}) {
  const root = useRef<Group>(null);
  const moving = useRef(false);
  const [walking, setWalking] = useState(false);
  const invalidate = useThree((state) => state.invalidate);
  const seat = seats.find((item) => item.id === person.seatId);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!root.current) return;
    const current = person.motion ? sampleMotion(person.motion, Date.now() + clockOffset) : null;
    moving.current = !!current && !current.done && !reduced;
    setWalking(moving.current);
    if (moving.current && current) {
      root.current.position.fromArray(current.position);
      root.current.rotation.y = current.yaw;
    } else {
      root.current.position.set(
        seat?.x ?? ((index % 3) - 1) * 0.2,
        seat ? seat.y + 0.45 : 0,
        seat?.z ?? Math.max(...seats.map((item) => item.z)) + 2.1,
      );
      root.current.rotation.y = Math.PI;
    }
    invalidate();
  }, [
    person.motion,
    seat?.id,
    seat?.x,
    seat?.y,
    seat?.z,
    index,
    clockOffset,
    reduced,
    invalidate,
    seats,
  ]);
  useFrame(() => {
    if (!moving.current || !person.motion || !root.current) return;
    const current = sampleMotion(person.motion, Date.now() + clockOffset);
    root.current.position.fromArray(current.position);
    root.current.rotation.y = current.done ? Math.PI : current.yaw;
    if (current.done) {
      moving.current = false;
      setWalking(false);
    }
    invalidate();
  });
  return (
    <group ref={root} visible={!hidden} scale={0.6}>
      <Avatar appearance={person.appearance} seated={!!seat && !walking} walking={walking} />
    </group>
  );
}
