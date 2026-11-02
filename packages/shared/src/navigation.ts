export type Point3 = [number, number, number];
export interface AvatarMotion {
  path: Point3[];
  startedAt: number;
  durationMs: number;
}
export interface LocatedSeat {
  x: number;
  y: number;
  z: number;
}

export function seatRoute(
  seats: LocatedSeat[],
  from: LocatedSeat | undefined,
  to: LocatedSeat | undefined,
  spawnIndex = 0,
): Point3[] {
  const lobby: Point3 = [
    ((spawnIndex % 3) - 1) * 0.2,
    0,
    Math.max(...seats.map((seat) => seat.z)) + 2.1,
  ];
  const path: Point3[] = from
    ? [
        [from.x, from.y + 0.45, from.z],
        [from.x, from.y, from.z - 1],
        [0, 0, from.z - 1],
      ]
    : [lobby, [0, 0, lobby[2]]];
  if (to) path.push([0, 0, to.z - 1], [to.x, to.y, to.z - 1], [to.x, to.y + 0.45, to.z]);
  else path.push([0, 0, lobby[2]], lobby);
  return path.filter((point, index) => index === 0 || distance(point, path[index - 1]!) > 0.001);
}
const distance = (a: Point3, b: Point3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function motionDuration(path: Point3[], speed = 2.4) {
  return Math.max(
    250,
    (path.slice(1).reduce((sum, point, index) => sum + distance(point, path[index]!), 0) / speed) *
      1000,
  );
}
export function sampleMotion(motion: AvatarMotion, now: number) {
  const progress = Math.min(1, Math.max(0, (now - motion.startedAt) / motion.durationMs));
  if (progress === 1)
    return { position: motion.path.at(-1) ?? ([0, 0, 0] as Point3), yaw: Math.PI, done: true };
  const lengths = motion.path.slice(1).map((point, index) => distance(point, motion.path[index]!));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * progress;
  for (let index = 0; index < lengths.length; index++) {
    const length = lengths[index]!;
    if (remaining <= length || index === lengths.length - 1) {
      const from = motion.path[index]!,
        to = motion.path[index + 1]!;
      const fraction = length ? Math.min(1, remaining / length) : 1;
      return {
        position: from.map((value, axis) => value + (to[axis]! - value) * fraction) as Point3,
        yaw: Math.atan2(to[0] - from[0], to[2] - from[2]),
        done: progress === 1,
      };
    }
    remaining -= length;
  }
  return { position: motion.path.at(-1) ?? ([0, 0, 0] as Point3), yaw: Math.PI, done: true };
}
