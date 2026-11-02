import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultAppearance,
  generateLayout,
  canStandAt,
  roomSchema,
  type RoomRecord,
  seatRoute,
  motionDuration,
  sampleMotion,
} from '../packages/shared/src/index.js';
import { RoomState } from '../apps/server/src/room-state.js';
import { parseByteRange, validMediaHeader } from '../apps/server/src/media.js';
import { allowedRealtimeRequest, configuredOrigins } from '../apps/server/src/origins.js';
import { isPrivateIPv4, lanInterfaces } from '../scripts/lan-network.mjs';
import { youtubeVideoId } from '../packages/shared/src/youtube.js';

test('YouTube links accept video forms and reject unrelated hosts or malformed IDs', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12',
    'https://youtu.be/dQw4w9WgXcQ?si=test',
    'https://m.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/live/dQw4w9WgXcQ',
  ])
    assert.equal(youtubeVideoId(url), 'dQw4w9WgXcQ');
  for (const url of [
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/bad',
    'javascript:alert(1)',
    'https://example.com/movie.mp4',
    null,
  ])
    assert.equal(youtubeVideoId(url), null);
});

const record: RoomRecord = {
  id: 'room',
  ownerId: 'a',
  name: 'Test room',
  type: 'couple',
  capacity: 5,
  maxParticipants: 3,
  createdAt: new Date().toISOString(),
};
test('LAN discovery prefers physical Wi-Fi and validates an explicit interface', () => {
  const row = (address: string, internal = false) => ({ address, family: 'IPv4', internal });
  const interfaces = {
    Ethernet: [row('10.0.0.3')],
    'ZeroTier One': [row('10.174.179.24')],
    'Wi-Fi': [row('192.168.86.13')],
    Loopback: [row('127.0.0.1', true)],
  };
  assert.deepEqual(
    lanInterfaces(interfaces).map((row: { address: string }) => row.address),
    ['192.168.86.13', '10.0.0.3'],
  );
  assert.equal(lanInterfaces(interfaces, '10.174.179.24')[0]?.address, '10.174.179.24');
  assert.throws(() => lanInterfaces(interfaces, '192.168.1.99'));
  assert.equal(isPrivateIPv4('172.31.0.1'), true);
  assert.equal(isPrivateIPv4('172.32.0.1'), false);
  assert.equal(isPrivateIPv4('8.8.8.8'), false);
  assert.equal(isPrivateIPv4('999.1.1.1'), false);
});
test('origin configuration adds exact LAN origins without allowing arbitrary sites', () => {
  const origins = configuredOrigins({
    APP_ORIGINS: 'http://192.168.86.13:5173,https://192.168.86.13:5173',
  });
  assert.ok(origins.has('http://192.168.86.13:5173'));
  assert.ok(origins.has('https://192.168.86.13:5173'));
  assert.equal(origins.has('http://192.168.86.14:5173'), false);
  for (const value of [
    '*',
    'https://example.com/private',
    'https://user:pass@example.com',
    'https://example.com?token=x',
  ])
    assert.throws(() => configuredOrigins({ APP_ORIGINS: value }));
});
test('realtime accepts LAN polling without Fetch Metadata only with same-origin evidence', () => {
  const origin = 'http://192.168.86.13:5173';
  const origins = new Set([origin]);
  const headers = { host: '192.168.86.13:5173', referer: `${origin}/?room=test` };
  assert.equal(allowedRealtimeRequest(headers, origins), true);
  assert.equal(allowedRealtimeRequest({ host: headers.host }, origins), false);
  assert.equal(allowedRealtimeRequest({ ...headers, origin: 'http://evil.test' }, origins), false);
  assert.equal(
    allowedRealtimeRequest({ ...headers, referer: 'http://evil.test/' }, origins),
    false,
  );
  assert.equal(allowedRealtimeRequest({ ...headers, host: 'localhost:3001' }, origins), false);
  assert.equal(allowedRealtimeRequest({ ...headers, referer: 'invalid' }, origins), false);
  assert.equal(
    allowedRealtimeRequest({ ...headers, 'sec-fetch-site': 'cross-site' }, origins),
    false,
  );
  assert.equal(
    allowedRealtimeRequest({ host: headers.host, 'sec-fetch-site': 'same-origin' }, origins),
    true,
  );
});
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

test('room queue preserves playback, deduplicates YouTube, toggles votes and checks deletion rights', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.join(person('b'));
  state.command('a', { action: 'source', url: 'https://example.com/current.mp4' }, 1000);
  state.enqueue('a', 'https://youtu.be/dQw4w9WgXcQ', 'First');
  state.enqueue('b', 'https://example.com/second.mp4', 'Second');
  assert.equal(state.playback.sourceUrl, 'https://example.com/current.mp4');
  assert.equal(state.playback.revision, 1);
  assert.throws(() => state.enqueue('b', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'), /đã có/);
  const first = state.queue[0]!,
    second = state.queue[1]!;
  state.editQueue('b', 'vote', second.id);
  assert.equal(state.queue[0]!.id, second.id);
  state.editQueue('b', 'vote', second.id);
  assert.equal(second.votes.length, 0);
  assert.throws(() => state.editQueue('b', 'remove', first.id));
  state.editQueue('a', 'remove', second.id);
  assert.equal(state.snapshot().queue.length, 1);
  state.disconnect('b');
  assert.throws(() => state.enqueue('b', 'https://example.com/other.mp4'));
  assert.throws(() => state.editQueue('b', 'vote', first.id));
});

test('queue advance is host-only and rejects duplicate ended revisions without skipping videos', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.join(person('b'));
  state.enqueue('b', 'https://example.com/first.mp4', 'First');
  state.enqueue('a', 'https://example.com/second.mp4', 'Second');
  assert.throws(() => state.startQueued('b', 0));
  state.startQueued('a', 0, 1000);
  assert.equal(state.playback.title, 'First');
  assert.equal(state.playback.playing, true);
  assert.equal(state.playback.revision, 2);
  assert.equal(state.queue.length, 1);
  assert.throws(() => state.startQueued('a', 0, 1100));
  assert.equal(state.queue.length, 1);
  state.disconnect('a');
  state.startQueued('b', 2, 1200);
  assert.equal(state.playback.title, 'Second');
  assert.equal(state.queue.length, 0);
  assert.throws(() => state.startQueued('b', 4));
});

test('queue has a bounded size and owner can remove their own entry', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.join(person('b'));
  for (let index = 0; index < 50; index++) state.enqueue('b', `https://example.com/${index}.mp4`);
  assert.throws(() => state.enqueue('a', 'https://example.com/full.mp4'), /50/);
  state.editQueue('b', 'remove', state.queue[0]!.id);
  state.enqueue('a', 'https://example.com/new.mp4');
  assert.equal(state.queue.length, 50);
});

test('image queue entries project without starting a video timeline', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.enqueue('a', '/api/media/qa/stream', 'Photo', 'qa', 'image');
  state.startQueued('a', 0, 1000);
  assert.equal(state.playback.kind, 'image');
  const restored = new RoomState(record);
  restored.restoreMedia(state.savedMedia());
  assert.equal(restored.playback.kind, 'image');
  assert.equal(state.playback.mediaId, 'qa');
  assert.equal(state.playback.playing, false);
  assert.equal(state.position(100000), 0);
  assert.throws(() => state.command('a', { action: 'play', position: 0 }), /Ảnh đang chiếu/);
  state.enqueue('a', 'https://example.com/video.mp4');
  state.startQueued('a', 1, 2000);
  assert.equal(state.playback.kind, 'video');
  assert.equal(state.playback.playing, true);
});

test('media upload signatures reject disguised files and accept image formats', () => {
  assert.equal(
    validMediaHeader('image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])),
    true,
  );
  assert.equal(
    validMediaHeader('image/jpeg', Buffer.from([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0])),
    true,
  );
  assert.equal(validMediaHeader('image/webp', Buffer.from('RIFF0000WEBP')), true);
  assert.equal(validMediaHeader('image/png', Buffer.from('<script>bad</script>')), false);
  assert.equal(validMediaHeader('image/svg+xml', Buffer.from('<svg></svg>')), false);
});
import { wheelOptionAt } from '../apps/web/src/components/wheel-selection.js';

test('quick wheel selects every sector and cancels in the center or outside', () => {
  for (let index = 0; index < 6; index++) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 6;
    assert.equal(wheelOptionAt(Math.cos(angle) * 82, Math.sin(angle) * 82, 6), index);
  }
  assert.equal(wheelOptionAt(0, 0, 6), -1);
  assert.equal(wheelOptionAt(0, -200, 6), -1);
  assert.equal(wheelOptionAt(NaN, 82, 6), -1);
  assert.equal(wheelOptionAt(0, -82, 0), -1);
  // Between buttons must cancel instead of choosing a neighboring action accidentally.
  assert.equal(wheelOptionAt(41, -71, 6), -1);
});

test('large custom theaters preserve slots, aisle, tiers and admission limits', () => {
  for (const capacity of [101, 150, 299, 300])
    for (const seatsPerRow of [4, 11, 12, 20]) {
      const config = {
        ...record,
        capacity,
        maxParticipants: capacity,
        seatsPerRow,
        rowRise: 0.4,
        rowSpacing: 2.6,
      };
      assert.ok(roomSchema.safeParse(config).success);
      const seats = generateLayout(config);
      assert.equal(seats.length, capacity);
      assert.equal(new Set(seats.map((s) => s.id)).size, capacity);
      assert.equal(new Set(seats.map((s) => s.x + ',' + s.z)).size, capacity);
      assert.ok(seats.every((s) => Math.abs(s.x) >= 1.25));
      assert.equal(seats[seatsPerRow]!.y, 0.4);
    }
  assert.equal(roomSchema.safeParse({ ...record, capacity: 301 }).success, false);
  const state = new RoomState({ ...record, capacity: 150, maxParticipants: 101 });
  for (let i = 0; i < 101; i++) state.join(person('large-' + i));
  assert.throws(() => state.join(person('overflow')), /đủ người/);
});
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { clipToCssMatrix } from '../apps/web/src/scene/screen-projection.js';
const cinemaScreen = theaterDimensions(generateLayout(record)).screen;
test('screen iframe corners coincide with the 3D screen after rotation, zoom and resize', () => {
  for (const [width, height, yaw] of [
    [390, 844, 0],
    [844, 390, 0.55],
    [1280, 720, -0.4],
  ]) {
    const camera = new PerspectiveCamera(50, width! / height!, 0.06, 90);
    camera.position.set(Math.sin(yaw!) * 5, 4, 12);
    camera.lookAt(0, cinemaScreen.y, -5);
    camera.updateMatrixWorld();
    const model = new Matrix4().set(
      cinemaScreen.width / 960,
      0,
      0,
      -cinemaScreen.width / 2,
      0,
      -cinemaScreen.height / 540,
      0,
      cinemaScreen.y + cinemaScreen.height / 2,
      0,
      0,
      1,
      cinemaScreen.z,
      0,
      0,
      0,
      1,
    );
    const clip = new Matrix4()
      .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(model);
    const css = clipToCssMatrix(clip.elements, width!, height!);
    for (const [x, y] of [
      [0, 0],
      [960, 0],
      [960, 540],
      [0, 540],
    ]) {
      const projected = new Vector3(x!, y!, 0).applyMatrix4(model).project(camera);
      const w = css[3]! * x! + css[7]! * y! + css[15]!;
      const actualX = (css[0]! * x! + css[4]! * y! + css[12]!) / w;
      const actualY = (css[1]! * x! + css[5]! * y! + css[13]!) / w;
      assert.ok(Math.abs(actualX - (projected.x + 1) * width! * 0.5) < 0.000001);
      assert.ok(Math.abs(actualY - (1 - projected.y) * height! * 0.5) < 0.000001);
    }
  }
  assert.deepEqual(clipToCssMatrix(new Array(16).fill(0), 390, 844), []);
});

test('room media survives reconstruction with queue, votes and advancing playback', () => {
  const state = new RoomState(record);
  state.join(person('a'));
  state.enqueue('a', 'https://youtu.be/dQw4w9WgXcQ', 'First');
  state.enqueue('a', 'https://youtu.be/abcdefghijk', 'Second');
  state.startQueued('a', 0, 10000);
  state.editQueue('a', 'vote', state.queue[0]!.id);
  state.watchSessionId = 'saved-session';
  const restored = new RoomState(record);
  restored.restoreMedia(JSON.parse(JSON.stringify(state.savedMedia())));
  assert.deepEqual(restored.queue, state.queue);
  assert.equal(restored.playback.title, 'First');
  assert.equal(restored.playback.playing, true);
  assert.equal(restored.position(15000), 5);
  assert.equal(restored.watchSessionId, 'saved-session');
  restored.join(person('a'));
  restored.command('a', { action: 'pause', position: 5 }, 15000);
  const paused = new RoomState(record);
  paused.restoreMedia(restored.savedMedia());
  assert.equal(paused.position(30000), 5);
});

test('invalid saved media leaves a new room empty', () => {
  const state = new RoomState(record);
  state.restoreMedia({ version: 1, queue: 'invalid' });
  assert.deepEqual(state.queue, []);
  assert.equal(state.playback.sourceUrl, null);
});

test('new arrivals stand on the rear tier instead of sinking into the floor', () => {
  const state = new RoomState({ ...record, capacity: 12, seatsPerRow: 4, rowRise: 0.4 });
  state.join(person('a'));
  const position = state.participants.get('a')!.position!;
  assert.equal(position[1], 0.8);
  assert.ok(position[2] > Math.max(...generateLayout(state.room).map((seat) => seat.z)));
});

import { theaterDimensions } from '../apps/web/src/scene/screen-projection.js';
import {
  clampPitch,
  cameraZoom,
  firstPersonFov,
  orbitElevation,
  orbitOffset,
  screenFitDistance,
} from '../apps/web/src/scene/camera-math.js';
import { sampleScreenZones } from '../apps/web/src/scene/screen-light.js';

test('wall-sized screens fit the room shell and preserve the embedded video aspect', () => {
  for (const capacity of [2, 12, 81, 300]) {
    const seats = generateLayout({
      ...record,
      capacity,
      maxParticipants: Math.min(3, capacity),
      seatsPerRow: capacity === 300 ? 20 : 4,
    });
    const shape = theaterDimensions(seats);
    assert.ok(shape.screen.width >= shape.halfWidth * 2 * 0.95);
    assert.equal(shape.screen.width / shape.screen.height, 16 / 9);
    assert.ok(shape.screen.y - shape.screen.height / 2 > 0.15);
    assert.ok(shape.screen.y + shape.screen.height / 2 < shape.top - 0.2);
  }
});

test('camera zoom keeps moving at every yaw and orbit pitch without wall dead zones', () => {
  for (const mode of ['walk', 'explore', 'focus'] as const) {
    let previousElevation = -Infinity;
    const min = clampPitch(mode, -100),
      max = clampPitch(mode, 100);
    for (let step = 0; step <= 20; step++) {
      const elevation = orbitElevation(mode, min + ((max - min) * step) / 20);
      assert.ok(elevation > previousElevation);
      assert.ok(elevation > 0 && elevation < Math.PI / 2);
      previousElevation = elevation;
      for (let yaw = -Math.PI * 2; yaw <= Math.PI * 2; yaw += Math.PI / 8) {
        const close = orbitOffset(yaw, elevation, cameraZoom.min * 5.8);
        const far = orbitOffset(yaw, elevation, cameraZoom.max * 5.8);
        assert.ok(close.every(Number.isFinite) && far.every(Number.isFinite));
        assert.ok(
          Math.abs(Math.hypot(...far) / Math.hypot(...close) - cameraZoom.max / cameraZoom.min) <
            1e-8,
        );
      }
    }
  }
  let last = 0;
  for (let i = 0; i <= 40; i++) {
    const fov = firstPersonFov(cameraZoom.min + ((cameraZoom.max - cameraZoom.min) * i) / 40);
    assert.ok(fov > last && fov >= 30 && fov <= 95);
    last = fov;
  }
});

test('screen illumination keeps spatial color and dims for real black frames', () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
  const zones = sampleScreenZones(pixels, 2, 1)!;
  assert.equal(zones[0]!.r, 1);
  assert.equal(zones[0]!.b, 0);
  assert.equal(zones[1]!.r, 0);
  assert.equal(zones[1]!.b, 1);
  assert.ok(zones[0]!.luminance > zones[1]!.luminance);
  assert.ok(sampleScreenZones(new Uint8ClampedArray(8), 2, 1)!.every((s) => s.luminance === 0));
  assert.equal(sampleScreenZones(new Uint8ClampedArray(4), 2, 1), null);
});

test('focus view fits every screen corner on portrait and tilted wide views', () => {
  const screen = theaterDimensions(generateLayout({ ...record, capacity: 12 })).screen;
  for (const aspect of [390 / 844, 844 / 390, 16 / 9])
    for (const yaw of [-1.1, 0, 1.1])
      for (const elevation of [0.06, 0.14, 0.7]) {
        const distance = screenFitDistance(screen.width, screen.height, aspect, yaw, elevation);
        const camera = new PerspectiveCamera(50, aspect, 0.06, 1500);
        const center = new Vector3(0, screen.y, screen.z);
        camera.position.fromArray(orbitOffset(yaw, elevation, distance)).add(center);
        camera.lookAt(center);
        camera.updateMatrixWorld();
        for (const x of [-screen.width / 2, screen.width / 2])
          for (const y of [-screen.height / 2, screen.height / 2]) {
            const corner = new Vector3(x, screen.y + y, screen.z).project(camera);
            assert.ok(Math.abs(corner.x) < 1 && Math.abs(corner.y) < 1);
          }
      }
});

test('four-block seating preserves clear aisles and keeps each loveseat together', () => {
  for (const columns of [2, 4, 7, 11, 12, 20])
    for (const type of ['standard', 'couple'] as const) {
      const seats = generateLayout({
        ...record,
        type,
        capacity: 101,
        maxParticipants: 3,
        seatsPerRow: columns,
      });
      for (const row of new Set(seats.map((s) => s.z)))
        assert.equal(canStandAt(seats, 0, row), true);
      if (type === 'couple') {
        const groups = new Map<string, typeof seats>();
        seats.forEach((seat) =>
          groups.set(seat.groupId, [...(groups.get(seat.groupId) ?? []), seat]),
        );
        for (const group of groups.values())
          if (group.length === 2) assert.ok(Math.abs(group[0]!.x - group[1]!.x) < 1.31);
      }
    }
});

import { defaultStageSettings, stageSlots, samplePairDance, isOnStage } from '../packages/shared/src/stage.js';
import { dancePose } from '../apps/web/src/scene/dance-pose.js';
function stageRoom() {
  const state=new RoomState({...record,type:'standard',capacity:12,maxParticipants:3});
  for (const id of ['a','b','c']) state.join(person(id));
  state.commitStage(state.nextStageSettings('a',{action:'configure',revision:0,settings:{enabled:true,lighting:'concert',fireworks:true}},1000));
  return state;
}
function arriveOnStage(state:RoomState,id:string,now=2000) {
  state.handleStage(id,{action:'enter'},now);
  const motion=state.participants.get(id)!.motion!;
  assert.ok(motion && motion.kind==='walk');
  state.finishMovement(id,motion.startedAt);
  assert.ok(isOnStage(state.participants.get(id)!.position));
}
test('stage configuration is host-only, versioned and restores without transient dancers',()=>{
  const state=stageRoom();
  assert.throws(()=>state.nextStageSettings('b',{action:'configure',revision:1,settings:{fireworks:false}}),/Chỉ chủ phòng/);
  assert.throws(()=>state.nextStageSettings('a',{action:'configure',revision:0,settings:{enabled:false}}),/đã thay đổi/);
  const restored=new RoomState(state.room);restored.restoreStage(JSON.parse(JSON.stringify(state.stageSettings)));
  assert.deepEqual(restored.stageSettings,state.stageSettings);
  assert.deepEqual(restored.stageSnapshot().pairs,[]);
  restored.restoreStage({enabled:true});assert.deepEqual(restored.stageSettings,state.stageSettings);
});
test('paired dance requires consent from the invited standing stage participant',()=>{
  const state=stageRoom();arriveOnStage(state,'a');arriveOnStage(state,'b');
  state.handleStage('a',{action:'invite',to:'b',style:'waltz'},10000);
  const invite=[...state.danceInvites.values()][0]!;
  assert.equal(state.dancePairs.size,0);
  assert.throws(()=>state.handleStage('a',{action:'respond',id:invite.id,accept:true},10100),/không hợp lệ/);
  assert.throws(()=>state.handleStage('c',{action:'respond',id:invite.id,accept:true},10100),/không hợp lệ/);
  state.handleStage('b',{action:'respond',id:invite.id,accept:true},10200);
  const pair=[...state.dancePairs.values()][0]!;
  assert.deepEqual(pair.users,['a','b']);
  assert.equal(state.activeActions.get('a')?.partnerId,'b');
  assert.equal(state.activeActions.get('b')?.role,1);
  const poses=pair.users.map(id=>samplePairDance(pair,id,15000));
  assert.ok(Math.abs(Math.hypot(poses[0]!.position[0]-poses[1]!.position[0],poses[0]!.position[2]-poses[1]!.position[2])-.74)<1e-6);
  state.tickMovement(.066,15000);
  assert.deepEqual(state.participants.get('a')!.position,poses[0]!.position);
  state.setInput('a',0,0,15000);assert.equal(state.dancePairs.size,1);
  state.setInput('a',1,0,15100);assert.equal(state.dancePairs.size,0);
  assert.equal(state.activeActions.size,0);
});
test('declined, expired and disconnected dance sessions never retain a partner',()=>{
  const state=stageRoom();arriveOnStage(state,'a');arriveOnStage(state,'b');
  state.handleStage('a',{action:'invite',to:'b',style:'salsa'},10000);
  let invite=[...state.danceInvites.values()][0]!;
  state.handleStage('b',{action:'respond',id:invite.id,accept:false},10100);
  assert.equal(state.dancePairs.size,0);assert.equal(state.danceInvites.size,0);
  state.handleStage('a',{action:'invite',to:'b',style:'salsa'},16000);
  invite=[...state.danceInvites.values()][0]!;
  assert.throws(()=>state.handleStage('b',{action:'respond',id:invite.id,accept:true},37000),/không hợp lệ/);
  assert.equal(state.danceInvites.size,0);
  state.handleStage('a',{action:'invite',to:'b',style:'salsa'},40000);
  invite=[...state.danceInvites.values()][0]!;
  state.handleStage('b',{action:'respond',id:invite.id,accept:true},40100);
  state.disconnect('a');assert.equal(state.dancePairs.size,0);assert.equal(state.activeActions.size,0);
  assert.equal(state.stageSlots.has('a'),false);
});
test('solo dance enforces posture and paired clips cannot bypass the invitation flow',()=>{
  const state=stageRoom();
  state.claim('a','A1',1000);
  assert.throws(()=>state.performAction('a','dance_hiphop',10000),/Đứng lên/);
  assert.throws(()=>state.performAction('b','duet_waltz',10000),/lời mời/);
  for (const style of ['dance_hiphop','dance_shuffle','dance_salsa','dance_disco','dance_ballet'] as const) {
    const pose=dancePose(style,1.25);
    assert.ok([...pose.armsX,...pose.armsZ,...pose.legs,...pose.knees,pose.x,pose.y,pose.z].every(Number.isFinite));
  }
  assert.notDeepEqual(dancePose('dance_hiphop',1.25),dancePose('dance_shuffle',1.25));
  arriveOnStage(state,'b');const event=state.performAction('b','dance_ballet',20000);
  assert.equal(event.duration,16000);
  assert.throws(()=>state.performAction('b','dance_salsa',20100),/Chờ/);
  state.handleStage('b',{action:'stop'},20100);assert.equal(state.activeActions.has('b'),false);
});
