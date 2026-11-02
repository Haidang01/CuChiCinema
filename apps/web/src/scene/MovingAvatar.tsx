import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  avatarActions,
  sampleMotion,
  type Participant,
  type Seat,
  type AvatarActionEvent,
  type ReactionEvent,
} from '@cineverse/shared';
import { Vector3, type Group } from 'three';
import Avatar from './Avatar';
import ActorLabel from './ActorLabel';
import { theaterDimensions } from './screen-projection';
export default function MovingAvatar({
  person,
  seats,
  index,
  clockOffset,
  hidden,
  mine,
  reaction,
  action,
}: {
  person: Participant;
  seats: Seat[];
  index: number;
  clockOffset: number;
  hidden: boolean;
  mine: boolean;
  reaction?: ReactionEvent;
  action?: AvatarActionEvent;
}) {
  const root = useRef<Group>(null);
  const target = useRef(new Vector3());
  const first = useRef(true);
  const lastWalking = useRef(false);
  const [walking, setWalking] = useState(false);
  const invalidate = useThree((state) => state.invalidate);
  const seat = seats.find((item) => item.id === person.seatId);
  const screenZ = theaterDimensions(seats).screen.z;
  useEffect(() => {
    invalidate();
  }, [person.position, person.motion, person.walking, person.yaw, seat?.id, invalidate]);
  useFrame((_, delta) => {
    if (!root.current) return;
    const sample = person.motion ? sampleMotion(person.motion, Date.now() + clockOffset) : null;
    const moving = sample ? !sample.done : !!person.walking;
    if (moving !== lastWalking.current) {
      lastWalking.current = moving;
      setWalking(moving);
    }
    if (sample) target.current.fromArray(sample.position);
    else if (seat) target.current.set(seat.x, seat.y + 0.45, seat.z);
    else
      target.current.fromArray(
        person.position ?? [
          ((index % 3) - 1) * 0.2,
          0,
          Math.max(...seats.map((item) => item.z)) + 2.1,
        ],
      );
    if (first.current) {
      root.current.position.copy(target.current);
      first.current = false;
    }
    const alpha = 1 - Math.exp(-18 * Math.min(delta, 0.1));
    root.current.position.lerp(target.current, alpha);
    const yaw = sample && !sample.done
      ? sample.yaw
      : seat
        ? Math.PI + Math.atan2(seat.x, seat.z - screenZ)
        : (person.yaw ?? Math.PI);
    root.current.rotation.y +=
      Math.atan2(Math.sin(yaw - root.current.rotation.y), Math.cos(yaw - root.current.rotation.y)) *
      alpha;
    if (moving || root.current.position.distanceToSquared(target.current) > 0.00001) invalidate();
  });
  return (
    <group ref={root} visible={!hidden}>
      <group scale={0.6}>
        <Avatar
          action={action}
          clockOffset={clockOffset}
          appearance={person.appearance}
          seated={!!seat && !walking}
          walking={walking}
        />
        <ActorLabel
          name={mine ? `${person.name} · Bạn` : person.name}
          mine={mine}
          emoji={
            reaction?.emoji ??
            (action ? avatarActions.find((item) => item.id === action.action)?.icon : undefined)
          }
        />
      </group>
      {mine ? (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.42, 40]} />
          <meshBasicMaterial color="#d4ee9b" transparent opacity={0.85} />
        </mesh>
      ) : null}
    </group>
  );
}
