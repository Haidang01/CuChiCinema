import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  characterSchema,
  credentialsSchema,
  registerSchema,
  roomSchema,
} from '../../../packages/shared/src/index.js';
import { db } from './db.js';
import { mediaRouter } from './media.js';
import { configuredOrigins } from './origins.js';
import {
  cookieName,
  cookieOptions,
  createSession,
  hashPassword,
  verifyPassword,
  publicUser,
  sessionFromRequest,
  makeToken,
  hashToken,
} from './auth.js';

export const origins = configuredOrigins();
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'media-src': ["'self'", 'https:', 'http:', 'blob:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'img-src': ["'self'", 'data:', 'blob:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: '16kb' }), cookieParser());
  app.use(
    '/api',
    rateLimit({ windowMs: 60000, limit: 200, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (
        req.headers['x-cineverse-client'] !== 'web' ||
        (req.headers.origin && !origins.has(req.headers.origin))
      ) {
        res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
        return;
      }
    }
    next();
  });
  app.get('/api/health', async (_, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected' });
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    message: { error: 'Bạn đã thử quá nhiều lần. Hãy đợi 15 phút.' },
  });
  app.post('/api/auth/register', authLimit, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const user = await db.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
      },
      include: { character: true },
    });
    const token = await createSession(user.id);
    res
      .cookie(cookieName, token, { ...cookieOptions, maxAge: 30 * 86400000 })
      .status(201)
      .json(publicUser(user));
  });
  app.post('/api/auth/login', authLimit, async (req, res) => {
    const input = credentialsSchema.parse(req.body);
    const user = await db.user.findUnique({
      where: { email: input.email },
      include: { character: true },
    });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      res.status(401).json({ error: 'Email hoặc mật khẩu chưa đúng.' });
      return;
    }
    const token = await createSession(user.id);
    res
      .cookie(cookieName, token, { ...cookieOptions, maxAge: 30 * 86400000 })
      .json(publicUser(user));
  });
  app.get('/api/auth/me', async (req, res) => {
    const session = await sessionFromRequest(req);
    res.json(session ? publicUser(session.user) : null);
  });
  app.post('/api/auth/logout', async (req, res) => {
    const session = await sessionFromRequest(req);
    if (session) {
      await db.session.delete({ where: { id: session.id } });
      app.locals.revokeSession?.(session.id);
    }
    res.clearCookie(cookieName, cookieOptions).json({ ok: true });
  });
  app.use('/api', async (req, res, next) => {
    const session = await sessionFromRequest(req);
    if (!session) {
      res.status(401).json({ error: 'Hãy đăng nhập để tiếp tục.' });
      return;
    }
    res.locals.user = session.user;
    next();
  });
  app.put('/api/character', async (req, res) => {
    const input = characterSchema.parse(req.body);
    const userId = res.locals.user.id as string;
    const character = await db.$transaction(async (tx) => {
      const previous = await tx.character.findUnique({ where: { userId } });
      const outfitId = `outfit-${input.appearance.outfit}`;
      const allowed = await tx.item.findUnique({ where: { id: outfitId } });
      if (!allowed) throw new Error('Vật phẩm khởi đầu chưa được chuẩn bị. Chạy npm run db:seed.');
      if (previous) {
        const required = [
          outfitId,
          ...(input.appearance.accessory === 'glasses' ? ['accessory-glasses'] : []),
        ];
        const owned = await tx.characterItem.count({
          where: { characterId: previous.id, itemId: { in: required } },
        });
        if (owned !== required.length) {
          res.status(403);
          throw new Error('Nhân vật chưa sở hữu vật phẩm này.');
        }
      }
      const saved = await tx.character.upsert({
        where: { userId },
        create: { userId, ...input, appearance: input.appearance },
        update: input,
      });
      if (!previous) {
        const items = await tx.item.findMany();
        await tx.characterItem.createMany({
          data: items.map((item) => ({ characterId: saved.id, itemId: item.id })),
        });
      }
      await tx.characterEvent.create({
        data: {
          characterId: saved.id,
          type: previous ? 'appearance_updated' : 'character_created',
          payload: {
            before: previous ? { name: previous.name, appearance: previous.appearance } : null,
            after: input,
          },
        },
      });
      return saved;
    });
    res.json(character);
  });
  app.use('/api/media', mediaRouter());
  app.get('/api/network', (_, res) => {
    res.json({
      shareOrigin: process.env.DEV_LAN === '1' ? (process.env.LAN_SHARE_ORIGIN ?? null) : null,
    });
  });
  app.get('/api/character/events', async (_, res) => {
    const character = res.locals.user.character;
    res.json(
      character
        ? await db.characterEvent.findMany({
            where: { characterId: character.id },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 50,
            select: { id: true, type: true, createdAt: true },
          })
        : [],
    );
  });
  app.get('/api/character/inventory', async (_, res) => {
    const character = res.locals.user.character;
    res.json(
      character
        ? await db.characterItem.findMany({
            where: { characterId: character.id },
            include: { item: true },
          })
        : [],
    );
  });
  app.get('/api/rooms', async (_, res) =>
    res.json(
      await db.room.findMany({
        where: { ownerId: res.locals.user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          ownerId: true,
          name: true,
          type: true,
          capacity: true,
          maxParticipants: true,
          createdAt: true,
        },
      }),
    ),
  );
  app.post('/api/rooms', async (req, res) => {
    const input = roomSchema.parse(req.body);
    if (!res.locals.user.character) {
      res.status(409).json({ error: 'Hãy tạo nhân vật trước khi tạo phòng.' });
      return;
    }
    const token = makeToken();
    const room = await db.room.create({
      data: { ...input, ownerId: res.locals.user.id, inviteTokenHash: hashToken(token) },
    });
    const { inviteTokenHash: _, ...result } = room;
    res.status(201).json({ room: result, token });
  });
  app.post('/api/rooms/:id/invite', async (req, res) => {
    const token = makeToken();
    const result = await db.room.updateMany({
      where: { id: String(req.params.id), ownerId: res.locals.user.id },
      data: { inviteTokenHash: hashToken(token) },
    });
    if (!result.count) {
      res.status(404).json({ error: 'Không tìm thấy phòng.' });
      return;
    }
    res.json({ token });
  });
  app.get('/api/history', async (_, res) => {
    const rows = await db.watchHistory.findMany({
      where: { userId: res.locals.user.id },
      include: { watchSession: { include: { room: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    res.json(
      rows.map((row) => ({
        id: row.id,
        position: row.position,
        updatedAt: row.updatedAt,
        roomName: row.watchSession.room.name,
      })),
    );
  });
  app.get('/api/voice/ice', (_, res) => {
    const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
      { urls: 'stun:stun.l.google.com:19302' },
    ];
    if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD)
      iceServers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD,
      });
    res.json({ iceServers });
  });
  app.use('/api', (_, res) => {
    res.status(404).json({ error: 'API không tồn tại.' });
  });
  return app;
}
export const errorHandler: express.ErrorRequestHandler = (error, _, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    res
      .status(409)
      .json({ error: 'Email đã được sử dụng hoặc dữ liệu vừa thay đổi. Hãy thử lại.' });
    return;
  }
  if (res.statusCode === 403) {
    res.json({ error: error.message });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Yêu cầu quá lớn.' });
    return;
  }
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'JSON không hợp lệ.' });
    return;
  }
  console.error('API error:', error?.code ?? error?.name ?? 'unknown');
  res.status(503).json({ error: 'Không thể xử lý yêu cầu. Kiểm tra kết nối server và database.' });
};
