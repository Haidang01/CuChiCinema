import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAppearance,
  generateLayout,
  roomSchema,
  type RoomRecord,
} from '../packages/shared/src/index.js';
import { RoomState } from '../apps/server/src/room-state.js';

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
test('seat claim is atomic and failed switch preserves the original seat', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.join(person('b'));
  state.claim('a', 'A1');
  state.claim('b', 'A2');
  assert.throws(() => state.claim('b', 'A1'));
  assert.equal(state.participants.get('b')?.seatId, 'A2');
  state.claim('a', 'B1');
  assert.equal(state.participants.get('a')?.seatId, 'B1');
  assert.throws(() => state.claim('b', 'Z99'));
  state.claim('a', null);
  assert.equal(state.participants.get('a')?.seatId, null);
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
