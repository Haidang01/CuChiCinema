import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import {
  appearanceSchema,
  playbackCommandSchema,
  type ClientEvents,
  type ServerEvents,
  type RoomRecord,
} from '../../../packages/shared/src/index.js';
import { cookieName, hashToken, sessionFromToken } from './auth.js';
import { db } from './db.js';
import { RoomState } from './room-state.js';

export function setupRealtime(http: HttpServer, origins: Set<string>) {
  const io = new Server<ClientEvents, ServerEvents>(http, {
    maxHttpBufferSize: 16000,
    allowRequest: (req, callback) => {
      // Same-origin browser GET polling does not necessarily include Origin.
      // Cross-site and non-browser requests still need an explicitly allowed Origin.
      const origin = req.headers.origin;
      const sameOriginPolling =
        !origin &&
        req.headers['sec-fetch-site'] === 'same-origin' &&
        [...origins].some((value) => new URL(value).host === req.headers.host);
      callback(null, origin ? origins.has(origin) : sameOriginPolling);
    },
  });
  const rooms = new Map<string, RoomState>();
  const locks = new Map<string, Promise<unknown>>();
  const clients = new Map<string, string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const movementTimers = new Map<string, ReturnType<typeof setTimeout>>();
  let stopping = false;
  const serial = async <T>(key: string, run: () => Promise<T>) => {
    const previous = locks.get(key) ?? Promise.resolve();
    const pending = previous.catch(() => {}).then(run);
    locks.set(key, pending);
    try {
      return await pending;
    } finally {
      if (locks.get(key) === pending) locks.delete(key);
    }
  };
  const broadcast = (state: RoomState) =>
    io.to(state.room.id).emit('room:snapshot', state.snapshot());
  const flush = async (state: RoomState) => {
    if (!state.watchSessionId) return;
    const watchSessionId = state.watchSessionId;
    const position = state.position();
    await Promise.all(
      [...state.participants.keys()].map((userId) =>
        db.watchHistory.upsert({
          where: { userId_watchSessionId: { userId, watchSessionId } },
          create: { userId, watchSessionId, position },
          update: { position },
        }),
      ),
    );
  };
  io.use(async (socket, next) => {
    try {
      const cookie = socket.request.headers.cookie
        ?.split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1);
      const session = await sessionFromToken(cookie);
      if (!session) return next(new Error('Hãy đăng nhập để vào phòng.'));
      socket.data = {
        user: session.user,
        sessionId: session.id,
        expiresAt: session.expiresAt.getTime(),
      };
      next();
    } catch {
      next(new Error('Không thể xác thực kết nối.'));
    }
  });
  io.on('connection', (socket) => {
    const user = socket.data.user as {
      id: string;
      displayName: string;
      character: { name: string; appearance: unknown } | null;
    };
    let roomId: string | undefined;
    let count = 0;
    let windowStart = Date.now();
    socket.use(async (_, next) => {
      if (Date.now() > socket.data.expiresAt) {
        socket.disconnect(true);
        return;
      }
      if (Date.now() - windowStart > 1000) {
        count = 0;
        windowStart = Date.now();
      }
      if (++count > 40) return next(new Error('Quá nhiều yêu cầu.'));
      try {
        const session = await db.session.findUnique({
          where: { id: socket.data.sessionId },
          select: { expiresAt: true },
        });
        if (!session || session.expiresAt.getTime() <= Date.now()) {
          socket.disconnect(true);
          return;
        }
      } catch {
        socket.disconnect(true);
        return;
      }
      next();
    });
    const detach = async (immediate: boolean) => {
      if (!roomId || stopping) return;
      const id = roomId;
      roomId = undefined;
      const key = `${id}:${user.id}`;
      if (clients.get(key) !== socket.id) return;
      clients.delete(key);
      await socket.leave(id);
      await serial(id, async () => {
        const state = rooms.get(id);
        if (!state) return;
        await flush(state).catch(() => console.error('Không thể lưu tiến độ xem.'));
        if (immediate) state.leave(user.id);
        else state.disconnect(user.id);
        broadcast(state);
        const expire = () => {
          timers.delete(key);
          state.leave(user.id);
          broadcast(state);
          if (!state.participants.size) rooms.delete(id);
        };
        if (immediate) {
          if (!state.participants.size) rooms.delete(id);
        } else timers.set(key, setTimeout(expire, 30000));
      });
    };
    socket.on('room:join', async (input, ack) => {
      if (typeof ack !== 'function') return;
      try {
        const value = z
          .object({ roomId: z.string().max(64), token: z.string().max(128).optional() })
          .parse(input);
        if (roomId && roomId !== value.roomId) await detach(true);
        await serial(value.roomId, async () => {
          const record = await db.room.findUnique({ where: { id: value.roomId } });
          if (
            !record ||
            (record.ownerId !== user.id && hashToken(value.token ?? '') !== record.inviteTokenHash)
          )
            throw new Error('Link mời không hợp lệ hoặc đã được thay mới.');
          if (!user.character) throw new Error('Hãy tạo nhân vật trước khi vào phòng.');
          let state = rooms.get(record.id);
          if (!state) {
            state = new RoomState({
              id: record.id,
              ownerId: record.ownerId,
              name: record.name,
              capacity: record.capacity,
              maxParticipants: record.maxParticipants,
              type: record.type as RoomRecord['type'],
              createdAt: record.createdAt.toISOString(),
            });
            rooms.set(record.id, state);
          }
          state.join({
            userId: user.id,
            name: user.character.name,
            appearance: appearanceSchema.parse(user.character.appearance),
            online: true,
            seatId: null,
          });
          const key = `${record.id}:${user.id}`;
          const previous = clients.get(key);
          clients.set(key, socket.id);
          if (previous && previous !== socket.id) {
            io.sockets.sockets.get(previous)?.emit('session:replaced');
            io.sockets.sockets.get(previous)?.disconnect(true);
          }
          clearTimeout(timers.get(key));
          timers.delete(key);
          roomId = record.id;
          await socket.join(record.id);
          broadcast(state);
          ack({ ok: true, data: state.snapshot() });
        });
      } catch (error) {
        ack({
          ok: false,
          error:
            error instanceof z.ZodError
              ? 'Thông tin phòng không hợp lệ.'
              : error instanceof Error
                ? error.message
                : 'Không thể vào phòng.',
        });
      }
    });
    socket.on('seat:claim', async (seatId, ack) => {
      if (typeof ack !== 'function') return;
      try {
        if (!roomId) throw new Error('Bạn chưa vào phòng.');
        const id = roomId;
        await serial(id, async () => {
          const state = rooms.get(id)!;
          state.claim(user.id, z.string().max(16).nullable().parse(seatId));
          const motion = state.participants.get(user.id)?.motion;
          if (motion) {
            const key = `${id}:${user.id}`;
            clearTimeout(movementTimers.get(key));
            movementTimers.set(
              key,
              setTimeout(
                () => {
                  movementTimers.delete(key);
                  void serial(id, async () => {
                    state.finishMovement(user.id, motion.startedAt);
                    if (rooms.get(id) === state) broadcast(state);
                  });
                },
                Math.max(0, motion.startedAt + motion.durationMs - Date.now()),
              ),
            );
          }
          broadcast(state);
          ack({ ok: true, data: state.snapshot() });
        });
      } catch (e) {
        ack({ ok: false, error: e instanceof Error ? e.message : 'Không thể chọn ghế.' });
      }
    });
    socket.on('playback:command', async (input, ack) => {
      if (typeof ack !== 'function') return;
      try {
        const command = playbackCommandSchema.parse(input);
        if (!roomId) throw new Error('Bạn chưa vào phòng.');
        const id = roomId;
        await serial(id, async () => {
          const state = rooms.get(id)!;
          if (state.hostId !== user.id) throw new Error('Chỉ chủ phòng được điều khiển phim.');
          if (command.action === 'media') {
            const asset = await db.mediaAsset.findUnique({ where: { id: command.mediaId } });
            if (!asset || asset.ownerId !== user.id) throw new Error('Bạn không sở hữu phim này.');
          }
          if (command.action === 'source' || command.action === 'media') {
            await flush(state);
            const session = await db.watchSession.create({
              data: {
                roomId: state.room.id,
                sourceUrl:
                  command.action === 'media' ? `/api/media/${command.mediaId}/stream` : command.url,
              },
            });
            state.watchSessionId = session.id;
          }
          state.command(user.id, command);
          await flush(state).catch(() => console.error('Không thể lưu tiến độ xem.'));
          broadcast(state);
          ack({ ok: true, data: state.snapshot() });
        });
      } catch (e) {
        ack({
          ok: false,
          error:
            e instanceof z.ZodError
              ? 'Lệnh phát phim không hợp lệ.'
              : e instanceof Error
                ? e.message
                : 'Không thể điều khiển phim.',
        });
      }
    });
    socket.on('voice:signal', (input) => {
      if (!roomId) return;
      const parsed = z.object({ to: z.string().max(64), signal: z.unknown() }).safeParse(input);
      if (!parsed.success) return;
      const target = clients.get(`${roomId}:${parsed.data.to}`);
      if (target && rooms.get(roomId)?.participants.get(parsed.data.to)?.online)
        io.to(target).emit('voice:signal', { from: user.id, signal: parsed.data.signal });
    });
    socket.on('clock:ping', (ack) => {
      if (typeof ack === 'function') ack(Date.now());
    });
    socket.on('room:leave', () => {
      void detach(true).catch(() => console.error('Không thể rời phòng.'));
    });
    socket.on('disconnect', () => {
      void detach(false).catch(() => console.error('Không thể cập nhật ngắt kết nối.'));
    });
  });
  const interval = setInterval(() => {
    for (const state of rooms.values())
      void flush(state).catch(() => console.error('Không thể lưu tiến độ xem.'));
  }, 15000);
  interval.unref();
  return {
    io,
    revokeSession: (sessionId: string) => {
      for (const socket of io.sockets.sockets.values())
        if (socket.data.sessionId === sessionId) socket.disconnect(true);
    },
    canReadMedia: (userId: string, mediaId: string) =>
      [...rooms.values()].some(
        (state) =>
          state.playback.mediaId === mediaId && state.participants.get(userId)?.online === true,
      ),
    stop: async () => {
      stopping = true;
      clearInterval(interval);
      io.disconnectSockets(true);
      await Promise.allSettled([...locks.values()]);
      for (const timer of timers.values()) clearTimeout(timer);
      for (const timer of movementTimers.values()) clearTimeout(timer);
      await Promise.all([...rooms.values()].map(flush));
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
