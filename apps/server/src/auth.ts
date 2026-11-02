import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request } from 'express';
import { db } from './db.js';

const scrypt = promisify(scryptCallback);
export const cookieName = 'cineverse_session';
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const makeToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, value: string) {
  const [salt, hash] = value.split(':');
  if (!salt || !hash) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const stored = Buffer.from(hash, 'hex');
  return stored.length === key.length && timingSafeEqual(stored, key);
}
export async function createSession(userId: string) {
  const token = makeToken();
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + 30 * 86400000) },
  });
  return token;
}
export async function sessionFromToken(token?: string) {
  if (!token || token.length > 128) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { character: true } } },
  });
  return session && session.expiresAt.getTime() > Date.now() ? session : null;
}
export const sessionFromRequest = (req: Request) => sessionFromToken(req.cookies?.[cookieName]);
export function publicUser(user: {
  id: string;
  email: string;
  displayName: string;
  character: unknown;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    character: user.character,
  };
}
