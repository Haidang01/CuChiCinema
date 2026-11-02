export type Point3 = [number, number, number];
export interface AvatarMotion {
  path: Point3[];
  startedAt: number;
  durationMs: number;
  kind?: 'seat' | 'walk';
}

export interface WalkSeat extends LocatedSeat {
  groupId?: string;
}
export function walkBounds(seats: LocatedSeat[]) {
  return {
    minX: Math.min(-5.5, ...seats.map((s) => s.x - 2)),
    maxX: Math.max(5.5, ...seats.map((s) => s.x + 2)),
    minZ: -3.5,
    maxZ: Math.max(...seats.map((seat) => seat.z)) + 3.3,
  };
}
export function canStandAt(seats: WalkSeat[], x: number, z: number, radius = 0.23) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const bounds = walkBounds(seats);
  if (
    x < bounds.minX + radius ||
    x > bounds.maxX - radius ||
    z < bounds.minZ + radius ||
    z > bounds.maxZ - radius
  )
    return false;
  const groups = new Map<string, WalkSeat[]>();
  seats.forEach((seat, index) => {
    const key = seat.groupId ?? String(index);
    groups.set(key, [...(groups.get(key) ?? []), seat]);
  });
  return ![...groups.values()].some(
    (group) =>
      x > Math.min(...group.map((seat) => seat.x)) - 0.64 - radius &&
      x < Math.max(...group.map((seat) => seat.x)) + 0.64 + radius &&
      Math.abs(z - group[0]!.z) < 0.57 + radius,
  );
}
export function clearWalkSegment(seats: WalkSeat[], from: Point3, to: Point3) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[2] - from[2]) / 0.08));
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    if (!canStandAt(seats, from[0] + (to[0] - from[0]) * t, from[2] + (to[2] - from[2]) * t))
      return false;
  }
  return true;
}
export function floorHeight(seats: LocatedSeat[], z: number) {
  const rows = [...new Map(seats.map((s) => [s.z, s.y])).entries()].sort((a, b) => a[0] - b[0]);
  if (!rows.length) return 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!,
      b = rows[i]!;
    if (z < (a[0] + b[0]) / 2) return a[1];
  }
  return rows.at(-1)![1];
}
export function slideWalk(seats: WalkSeat[], from: Point3, dx: number, dz: number): Point3 {
  const full: Point3 = [from[0] + dx, floorHeight(seats, from[2] + dz), from[2] + dz];
  if (clearWalkSegment(seats, from, full)) return full;
  const horizontal: Point3 = [from[0] + dx, floorHeight(seats, from[2]), from[2]];
  if (clearWalkSegment(seats, from, horizontal)) return horizontal;
  const vertical: Point3 = [from[0], floorHeight(seats, from[2] + dz), from[2] + dz];
  return clearWalkSegment(seats, from, vertical) ? vertical : from;
}

// A bounded grid keeps tap-to-walk paths on the same furniture bounds as joystick movement.
export function findWalkPath(seats: WalkSeat[], from: Point3, to: Point3): Point3[] | null {
  to = [to[0], floorHeight(seats, to[2]), to[2]];
  if (!canStandAt(seats, from[0], from[2]) || !canStandAt(seats, to[0], to[2])) return null;
  if (clearWalkSegment(seats, from, to))
    return [
      from,
      ...seats
        .filter(
          (s, i, all) =>
            all.findIndex((r) => r.z === s.z) === i &&
            s.z > Math.min(from[2], to[2]) &&
            s.z < Math.max(from[2], to[2]),
        )
        .sort((a, b) => (to[2] > from[2] ? 1 : -1) * (a.z - b.z))
        .map(
          (s) =>
            [
              from[0] + (to[0] - from[0]) * ((s.z - from[2]) / (to[2] - from[2])),
              s.y,
              s.z,
            ] as Point3,
        ),
      to,
    ];
  const bounds = walkBounds(seats);
  const cell = 0.32;
  const width = Math.floor((bounds.maxX - bounds.minX) / cell) + 1;
  const height = Math.floor((bounds.maxZ - bounds.minZ) / cell) + 1;
  const point = (id: number): Point3 => [
    bounds.minX + (id % width) * cell,
    floorHeight(seats, bounds.minZ + Math.floor(id / width) * cell),
    bounds.minZ + Math.floor(id / width) * cell,
  ];
  const walkable = new Uint8Array(width * height);
  for (let id = 0; id < walkable.length; id++) {
    const p = point(id);
    walkable[id] = Number(canStandAt(seats, p[0], p[2]));
  }
  const nearest = (p: Point3) => {
    let best = -1,
      distance = Infinity;
    for (let id = 0; id < walkable.length; id++)
      if (walkable[id]) {
        const q = point(id);
        const d = Math.hypot(p[0] - q[0], p[2] - q[2]);
        if (d < distance && d < 0.8 && clearWalkSegment(seats, p, q)) {
          best = id;
          distance = d;
        }
      }
    return best;
  };
  const start = nearest(from),
    goal = nearest(to);
  if (start < 0 || goal < 0) return null;
  const parents = new Int32Array(width * height).fill(-1);
  const queue = [start];
  parents[start] = start;
  for (let index = 0; index < queue.length && parents[goal] === -1; index++) {
    const id = queue[index]!;
    for (const next of [
      id - width,
      id + width,
      id % width ? id - 1 : -1,
      id % width < width - 1 ? id + 1 : -1,
    ]) {
      if (next < 0 || next >= walkable.length || !walkable[next] || parents[next] !== -1) continue;
      parents[next] = id;
      queue.push(next);
    }
  }
  if (parents[goal] === -1) return null;
  const route: Point3[] = [to];
  for (let id = goal; id !== start; id = parents[id]!) route.push(point(id));
  route.push(point(start), from);
  route.reverse();
  const simplified: Point3[] = [route[0]!];
  let index = 0;
  while (index < route.length - 1) {
    let next = route.length - 1;
    while (next > index + 1 && !clearWalkSegment(seats, route[index]!, route[next]!)) next--;
    simplified.push(route[next]!);
    index = next;
  }
  return simplified;
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
    Math.max(...seats.map((seat) => seat.y)),
    Math.max(...seats.map((seat) => seat.z)) + 2.1,
  ];
  const path: Point3[] = from
    ? [
        [from.x, from.y + 0.45, from.z],
        [from.x, from.y, from.z - 1],
        [0, floorHeight(seats, from.z - 1), from.z - 1],
      ]
    : [lobby, [0, floorHeight(seats, lobby[2]), lobby[2]]];
  if (to)
    path.push(
      [0, floorHeight(seats, to.z - 1), to.z - 1],
      [to.x, to.y, to.z - 1],
      [to.x, to.y + 0.45, to.z],
    );
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
