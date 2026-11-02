import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { createApp, errorHandler, origins } from '../../apps/server/src/app.js';
import { setupRealtime } from '../../apps/server/src/realtime.js';
import { db } from '../../apps/server/src/db.js';
import {
  defaultAppearance,
  type RoomSnapshot,
  type Ack,
  type ServerEvents,
  type ClientEvents,
} from '../../packages/shared/src/index.js';

test(
  'PostgreSQL auth, durable characters, ownership, private room, seat races and playback',
  { timeout: 45000 },
  async () => {
    assert.equal(
      new URL(process.env.DATABASE_URL!).pathname,
      '/cineverse_test',
      'Only disposable test database is permitted',
    );
    const app = createApp();
    app.use(errorHandler);
    const http = createServer(app);
    const realtime = setupRealtime(http, origins);
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
    const users: string[] = [];
    const sockets: Socket<ServerEvents, ClientEvents>[] = [];
    const password = randomBytes(24).toString('base64url');
    async function request(
      path: string,
      body?: unknown,
      cookie?: string,
      method = body ? 'POST' : 'GET',
    ) {
      const response = await fetch(`${base}/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Cineverse-Client': 'web',
          Origin: 'http://localhost:5173',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      return {
        status: response.status,
        data,
        cookie: response.headers.get('set-cookie')?.split(';')[0],
      };
    }
    async function account(tag: string) {
      const email = `qa-${tag}-${randomBytes(6).toString('hex')}@example.test`;
      const result = await request('/auth/register', { email, password, displayName: `QA ${tag}` });
      assert.equal(result.status, 201);
      assert.ok(result.cookie);
      users.push(result.data.id);
      assert.equal('passwordHash' in result.data, false);
      return { ...result, email };
    }
    async function connect(cookie: string) {
      const socket: Socket<ServerEvents, ClientEvents> = io(base, {
        transports: ['websocket'],
        extraHeaders: { Cookie: cookie, Origin: 'http://localhost:5173' },
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });
      return socket;
    }
    const join = (socket: Socket<ServerEvents, ClientEvents>, roomId: string, token?: string) =>
      new Promise<Ack<RoomSnapshot>>((resolve) =>
        socket.emit('room:join', { roomId, token }, resolve),
      );
    const claim = (socket: Socket<ServerEvents, ClientEvents>, seat: string) =>
      new Promise<Ack<RoomSnapshot>>((resolve) => socket.emit('seat:claim', seat, resolve));
    try {
      assert.equal((await request('/health')).status, 200);
      assert.equal((await request('/rooms')).status, 401);
      const a = await account('a'),
        b = await account('b');
      assert.equal(
        (await request('/auth/login', { email: a.email, password: 'wrong-password' })).status,
        401,
      );
      assert.equal(
        (await request('/auth/register', { email: a.email, password, displayName: 'Duplicate' }))
          .status,
        409,
      );
      const saved = await request(
        '/character',
        { name: 'Nhân vật A', appearance: defaultAppearance },
        a.cookie,
        'PUT',
      );
      assert.equal(saved.status, 200);
      assert.equal(saved.data.name, 'Nhân vật A');
      await request(
        '/character',
        { name: 'Nhân vật B', appearance: defaultAppearance },
        b.cookie,
        'PUT',
      );
      const changed = { ...defaultAppearance, hair: 'bun', outfit: 'rose', accessory: 'glasses' };
      assert.equal(
        (
          await request(
            '/character',
            { name: 'Nhân vật A mới', appearance: changed },
            a.cookie,
            'PUT',
          )
        ).status,
        200,
      );
      assert.equal((await request('/character/events', undefined, a.cookie)).data.length, 2);
      assert.equal((await request('/character/events', undefined, b.cookie)).data.length, 1);
      assert.equal((await request('/character/inventory', undefined, a.cookie)).data.length, 5);
      const login = await request('/auth/login', { email: a.email, password });
      const restored = await request('/auth/me', undefined, login.cookie);
      assert.deepEqual(restored.data.character.appearance, changed);
      assert.equal(
        (
          await request(
            '/character',
            { name: 'Invalid', appearance: { ...changed, outfit: 'admin-item' } },
            a.cookie,
            'PUT',
          )
        ).status,
        400,
      );
      const created = await request(
        '/rooms',
        { name: 'QA private room', type: 'couple', capacity: 5, maxParticipants: 3 },
        a.cookie,
      );
      assert.equal(created.status, 201);
      assert.equal('inviteTokenHash' in created.data.room, false);
      assert.equal((await request('/rooms', undefined, b.cookie)).data.length, 0);
      const roomId = created.data.room.id;
      const token = created.data.token;
      assert.equal((await request(`/rooms/${roomId}/invite`, {}, b.cookie)).status, 404);
      const sa = await connect(a.cookie!),
        sb = await connect(b.cookie!);
      assert.equal((await join(sb, roomId, 'invalid-token')).ok, false);
      assert.equal((await join(sa, roomId)).ok, true);
      assert.equal((await join(sb, roomId, token)).ok, true);
      const races = await Promise.all([claim(sa, 'A1'), claim(sb, 'A1')]);
      assert.equal(races.filter((v) => v.ok).length, 1);
      const unauthorized = await new Promise<Ack<RoomSnapshot>>((resolve) =>
        sb.emit(
          'playback:command',
          { action: 'source', url: 'https://example.com/movie.mp4' },
          resolve,
        ),
      );
      assert.equal(unauthorized.ok, false);
      const source = await new Promise<Ack<RoomSnapshot>>((resolve) =>
        sa.emit(
          'playback:command',
          { action: 'source', url: 'https://example.com/movie.mp4' },
          resolve,
        ),
      );
      assert.equal(source.ok, true);
      const playing = await new Promise<Ack<RoomSnapshot>>((resolve) =>
        sa.emit('playback:command', { action: 'play', position: 42 }, resolve),
      );
      assert.equal(playing.ok, true);
      if (playing.ok) assert.equal(playing.data.playback.revision, 2);
      const beforeReconnect = await claim(sa, 'A2');
      assert.equal(beforeReconnect.ok, true);
      sa.disconnect();
      const reconnected = await connect(a.cookie!);
      const restoredRoom = await join(reconnected, roomId);
      assert.equal(restoredRoom.ok, true);
      if (restoredRoom.ok) {
        assert.equal(
          restoredRoom.data.participants.find((v) => v.userId === a.data.id)?.seatId,
          'A2',
        );
        assert.equal(restoredRoom.data.playback.playing, true);
      }
      await request('/auth/logout', {}, a.cookie);
      assert.equal((await request('/auth/me', undefined, a.cookie)).data, null);
      const csrf = await fetch(`${base}/api/character`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: b.cookie!,
          Origin: 'https://evil.example',
        },
        body: JSON.stringify({ name: 'Injected', appearance: defaultAppearance }),
      });
      assert.equal(csrf.status, 403);
    } finally {
      for (const socket of sockets) socket.disconnect();
      await realtime.stop();
      await new Promise<void>((resolve) => http.close(() => resolve()));
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.$disconnect();
    }
  },
);
