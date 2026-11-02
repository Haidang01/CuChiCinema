import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAppearance,
  generateLayout,
  roomSchema,
  type RoomRecord,
  seatRoute,
  motionDuration,
  sampleMotion,
} from '../packages/shared/src/index.js';
import { RoomState } from '../apps/server/src/room-state.js';
import { parseByteRange } from '../apps/server/src/media.js';

const record: RoomRecord = {
  id: 'room',
  ownerId: 'a',
  name: 'Test room',
  type: 'couple',
  capacity: 5,
  maxParticipants: 3,
  createdAt: new Date().toISOString(),
};
const person = (userId: string) => ({
  userId,
  name: userId,
  appearance: defaultAppearance,
  seatId: null,
  online: true,
});
test('layouts preserve exact slot capacity, unique IDs and two-slot groups for odd couple capacity', () => {
  for (const type of ['standard', 'vip', 'couple', 'lounge'] as const)
    for (let capacity = 2; capacity <= 12; capacity++) {
      const seats = generateLayout({
        ...record,
        type,
        capacity,
        maxParticipants: Math.min(3, capacity),
      });
      assert.equal(seats.length, capacity);
      assert.equal(new Set(seats.map((s) => s.id)).size, capacity);
      const groups = new Map<string, number>();
      for (const s of seats) groups.set(s.groupId, (groups.get(s.groupId) ?? 0) + 1);
      assert.ok(
        [...groups.values()].every(
          (size) => size <= (type === 'couple' || type === 'lounge' ? 2 : 1),
        ),
      );
      assert.equal(new Set(seats.map((s) => `${s.x},${s.z}`)).size, capacity);
      if ((type === 'couple' || type === 'lounge') && capacity % 2)
        assert.equal(seats.at(-1)?.kind, 'standard');
    }
});
test('participant limit is independent of seats, cannot exceed capacity', () => {
  assert.ok(roomSchema.safeParse(record).success);
  assert.equal(roomSchema.safeParse({ ...record, capacity: 2, maxParticipants: 3 }).success, false);
  const state = new RoomState(record);
  state.join(person('a'));
  state.join(person('b'));
  state.join(person('c'));
  assert.throws(() => state.join(person('d')), /đủ người/);
});
test('single HTTP byte ranges handle suffix/open ends and reject malformed or unsafe requests', () => {
  assert.equal(parseByteRange(undefined, 100), null);
  assert.deepEqual(parseByteRange('bytes=10-19', 100), { start: 10, end: 19 });
  assert.deepEqual(parseByteRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseByteRange('bytes=0-999', 100), { start: 0, end: 99 });
  for (const value of [
    'bytes=-0',
    'bytes=100-',
    'bytes=20-10',
    'bytes=0-1,3-4',
    'bytes=-',
    'items=0-1',
    'bytes=90071992547409999-',
  ])
    assert.throws(() => parseByteRange(value, 100));
  assert.throws(() => parseByteRange('bytes=0-', 0));
});
test('seat claim is atomic and failed switch preserves the original seat', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.join(person('b'));
  state.claim('a', 'A1', 0);
  state.claim('b', 'A2', 0);
  assert.throws(() => state.claim('b', 'A1', 100000));
  assert.equal(state.participants.get('b')?.seatId, 'A2');
  state.claim('a', 'B1', 100000);
  assert.equal(state.participants.get('a')?.seatId, 'B1');
  assert.throws(() => state.claim('b', 'Z99'));
  state.claim('a', null, 200000);
  assert.equal(state.participants.get('a')?.seatId, null);
});
test('seat navigation uses clear aisles, reserves immediately and rejects mid-walk switches', () => {
  for (const type of ['standard', 'vip', 'couple', 'lounge'] as const) {
    const seats = generateLayout({ ...record, type, capacity: 12 });
    for (const seat of seats) {
      const path = seatRoute(seats, undefined, seat);
      const motion = { path, startedAt: 1000, durationMs: motionDuration(path) };
      assert.equal(sampleMotion(motion, 0).done, false);
      assert.deepEqual(sampleMotion(motion, 100000).position, path.at(-1));
      for (let step = 0; step <= 100; step++) {
        const point = sampleMotion(motion, 1000 + (motion.durationMs * step) / 100).position;
        for (const other of seats)
          if (other.id !== seat.id)
            assert.ok(
              Math.abs(point[0] - other.x) > 0.76 || Math.abs(point[2] - other.z) > 0.7,
              `Route crosses ${other.id}`,
            );
      }
    }
  }
  const state = new RoomState(record);
  state.join(person('a'));
  state.claim('a', 'A1', 1000);
  assert.equal(state.participants.get('a')?.seatId, 'A1');
  assert.throws(() => state.claim('a', 'A2', 1001), /đang di chuyển/);
  state.disconnect('a');
  state.join(person('a'));
  assert.ok(state.participants.get('a')?.motion);
  state.finishMovement('a', 0);
  assert.ok(state.participants.get('a')?.motion);
  state.finishMovement('a', 1000);
  assert.equal(state.participants.get('a')?.motion, null);
});
test('reconnect preserves a seat; expired/explicit leave frees it and transfers host', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.join(person('b'));
  state.claim('a', 'A1');
  state.disconnect('a');
  assert.equal(state.hostId, 'b');
  assert.throws(() => state.claim('b', 'A1'));
  state.join(person('a'));
  assert.equal(state.participants.get('a')?.seatId, 'A1');
  assert.equal(state.hostId, 'a');
  state.leave('a');
  state.claim('b', 'A1');
  assert.equal(state.hostId, 'b');
});
test('only host controls a monotonic playback revision; pause stops timeline extrapolation', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.join(person('b'));
  assert.throws(() =>
    state.command('b', { action: 'source', url: 'https://example.com/movie.mp4' }),
  );
  state.command('a', { action: 'source', url: 'https://example.com/movie.mp4' }, 1000);
  state.command('a', { action: 'play', position: 10 }, 2000);
  assert.equal(state.position(5000), 13);
  state.command('a', { action: 'pause', position: 13 }, 5000);
  assert.equal(state.position(10000), 13);
  state.command('a', { action: 'seek', position: 60 }, 11000);
  assert.equal(state.position(12000), 60);
  assert.equal(state.playback.revision, 4);
});
