import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, realpath, stat, unlink, open } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

function projectRoot() {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(directory, 'prisma/schema.prisma'))) {
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error('Không tìm thấy thư mục dự án.');
    directory = parent;
  }
  return directory;
}
export function mediaRoot() {
  return path.resolve(projectRoot(), process.env.MEDIA_ROOT || 'media');
}
export const maxMediaBytes = () => {
  const value = Number(process.env.MAX_MEDIA_BYTES || 4 * 1024 ** 3);
  return Number.isSafeInteger(value) && value > 0 ? value : 4 * 1024 ** 3;
};
export function parseByteRange(
  value: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size === 0) throw new Error('invalid-range');
  const from = match[1] ? Number(match[1]) : null;
  const to = match[2] ? Number(match[2]) : null;
  if ((from !== null && !Number.isSafeInteger(from)) || (to !== null && !Number.isSafeInteger(to)))
    throw new Error('invalid-range');
  const start = from === null ? Math.max(0, size - to!) : from;
  const end = from === null ? size - 1 : to === null ? size - 1 : Math.min(to, size - 1);
  if (start < 0 || start >= size || end < start || (from === null && to! <= 0))
    throw new Error('invalid-range');
  return { start, end };
}
const publicAsset = (asset: {
  id: string;
  title: string;
  mimeType: string;
  bytes: bigint;
  createdAt: Date;
}) => ({
  id: asset.id,
  title: asset.title,
  mimeType: asset.mimeType,
  bytes: Number(asset.bytes),
  createdAt: asset.createdAt.toISOString(),
});

export function mediaRouter() {
  const router = Router();
  router.get('/', async (_, res) => {
    const assets = await db.mediaAsset.findMany({
      where: { ownerId: res.locals.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ assets: assets.map(publicAsset), maxBytes: maxMediaBytes() });
  });
  router.post('/', async (req, res, next) => {
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const mimeType = req.headers['content-type']?.split(';')[0];
    if (!title || title.length > 120 || !['video/mp4', 'video/webm'].includes(mimeType ?? '')) {
      res.status(400).json({ error: 'Chọn file MP4/WebM và tên phim không quá 120 ký tự.' });
      return;
    }
    const limit = maxMediaBytes();
    if (Number(req.headers['content-length']) > limit) {
      res.status(413).json({ error: 'File vượt giới hạn dung lượng tải lên.' });
      return;
    }
    const id = randomUUID();
    const filename = `${id}${mimeType === 'video/mp4' ? '.mp4' : '.webm'}`;
    const root = mediaRoot();
    const file = path.join(root, filename);
    let bytes = 0;
    try {
      await mkdir(root, { recursive: true });
      const meter = new Transform({
        transform(chunk: Buffer, _, callback) {
          bytes += chunk.length;
          if (bytes > limit) callback(new Error('too-large'));
          else callback(null, chunk);
        },
      });
      // Do not buffer the movie in RAM or pipe IncomingMessage itself through a failing pipeline:
      // keeping the request socket alive allows a useful 413 response after a size-limit error.
      req.pipe(meter);
      const aborted = () => meter.destroy(new Error('upload-aborted'));
      req.once('aborted', aborted);
      try {
        await pipeline(meter, createWriteStream(file, { flags: 'wx' }));
      } finally {
        req.off('aborted', aborted);
        req.unpipe(meter);
        req.resume();
      }
      const handle = await open(file, 'r');
      const header = Buffer.alloc(12);
      try {
        await handle.read(header, 0, header.length, 0);
      } finally {
        await handle.close();
      }
      const valid =
        mimeType === 'video/mp4'
          ? header.subarray(4, 8).toString() === 'ftyp'
          : header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
      if (!valid || bytes < 12) {
        await unlink(file);
        res.status(400).json({ error: 'Nội dung file không đúng định dạng MP4/WebM.' });
        return;
      }
      const asset = await db.mediaAsset.create({
        data: {
          id,
          ownerId: res.locals.user.id,
          title,
          filename,
          mimeType: mimeType!,
          bytes: BigInt(bytes),
        },
      });
      res.status(201).json(publicAsset(asset));
    } catch (error) {
      await unlink(file).catch(() => {});
      if (req.aborted) return;
      if (error instanceof Error && error.message === 'too-large') {
        res.status(413).json({ error: 'File vượt giới hạn dung lượng tải lên.' });
        return;
      }
      next(error);
    }
  });
  router.get('/:id/stream', async (req, res, next) => {
    const asset = await db.mediaAsset.findUnique({ where: { id: String(req.params.id) } });
    if (
      !asset ||
      (asset.ownerId !== res.locals.user.id &&
        !req.app.locals.canReadMedia?.(res.locals.user.id, asset.id))
    ) {
      res.status(404).json({ error: 'Phim không tồn tại hoặc bạn chưa được phép xem.' });
      return;
    }
    try {
      const root = await realpath(mediaRoot());
      const file = await realpath(path.join(root, asset.filename));
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        res.sendStatus(404);
        return;
      }
      const info = await stat(file);
      if (!info.isFile()) {
        res.sendStatus(404);
        return;
      }
      const modified = info.mtime.toUTCString();
      let range;
      try {
        range = parseByteRange(
          !req.headers['if-range'] || req.headers['if-range'] === modified
            ? req.headers.range
            : undefined,
          info.size,
        );
      } catch {
        res.setHeader('Content-Range', `bytes */${info.size}`);
        res.sendStatus(416);
        return;
      }
      res.set({
        'Content-Type': asset.mimeType,
        'Accept-Ranges': 'bytes',
        'Last-Modified': modified,
        'Content-Length': String(range ? range.end - range.start + 1 : info.size),
        'Content-Disposition': `inline; filename="cineverse${path.extname(asset.filename)}"`,
      });
      if (range) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${info.size}`);
      }
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      await pipeline(createReadStream(file, range ?? {}), res);
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        res.status(404).json({ error: 'File phim đã được di chuyển hoặc không còn trên máy chủ.' });
        return;
      }
      next(error);
    }
  });
  return router;
}
