import { z } from 'zod';
export { seatRoute, motionDuration, sampleMotion } from './navigation.js';
export type { AvatarMotion, Point3 } from './navigation.js';
import type { AvatarMotion } from './navigation.js';

export const appearanceSchema = z.object({
  version: z.literal(1).default(1),
  skin: z.enum(['porcelain', 'sand', 'amber', 'cocoa']),
  hair: z.enum(['crop', 'bob', 'bun']),
  hairColor: z.enum(['espresso', 'chestnut', 'silver']),
  outfit: z.enum(['midnight', 'rose', 'sage', 'cream']),
  accessory: z.enum(['none', 'glasses']),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const defaultAppearance: Appearance = {
  version: 1,
  skin: 'sand',
  hair: 'bob',
  hairColor: 'espresso',
  outfit: 'midnight',
  accessory: 'none',
};
export const characterSchema = z.object({
  name: z.string().trim().min(2).max(32),
  appearance: appearanceSchema,
});
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(10).max(128),
});
export const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(40),
});
export const roomSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    type: z.enum(['standard', 'vip', 'couple', 'lounge']),
    capacity: z.number().int().min(2).max(12),
    maxParticipants: z.number().int().min(2).max(3),
  })
  .refine((v) => v.maxParticipants <= v.capacity, {
    message: 'Số người tham gia không được vượt số chỗ ngồi.',
    path: ['maxParticipants'],
  });
export type RoomConfig = z.infer<typeof roomSchema>;
export type Seat = {
  id: string;
  groupId: string;
  index: number;
  x: number;
  z: number;
  y: number;
  kind: string;
};
export function generateLayout(config: RoomConfig): Seat[] {
  roomSchema.parse(config);
  return Array.from({ length: config.capacity }, (_, i) => {
    const row = Math.floor(i / 4);
    const rowSize = Math.min(4, config.capacity - row * 4);
    const col = i % 4;
    const pair = config.type === 'couple' || config.type === 'lounge';
    const hasPair = pair && (col % 2 === 1 || col + 1 < rowSize);
    return {
      id: `${String.fromCharCode(65 + row)}${col + 1}`,
      groupId: pair ? `r${row}-g${Math.floor(col / 2)}` : `g${i}`,
      index: i,
      x: pair
        ? col < 2
          ? rowSize === 1
            ? -1.25
            : col === 0
              ? -2.75
              : -1.25
          : col === 2
            ? 1.25
            : 2.75
        : (rowSize === 1
            ? [-1.25]
            : rowSize === 2
              ? [-1.25, 1.25]
              : rowSize === 3
                ? [-2.75, -1.25, 1.25]
                : [-2.75, -1.25, 1.25, 2.75])[col]!,
      z: row * 2.2,
      y: row * 0.18,
      kind: hasPair ? 'loveseat' : pair ? 'standard' : config.type,
    };
  });
}
export interface Character {
  id: string;
  name: string;
  appearance: Appearance;
  createdAt: string;
  updatedAt: string;
}
export interface User {
  id: string;
  email: string;
  displayName: string;
  character: Character | null;
}
export interface CharacterEvent {
  id: string;
  type: string;
  createdAt: string;
}
export interface RoomRecord {
  id: string;
  name: string;
  type: RoomConfig['type'];
  capacity: number;
  maxParticipants: number;
  ownerId: string;
  createdAt: string;
}
export interface Participant {
  userId: string;
  name: string;
  appearance: Appearance;
  seatId: string | null;
  online: boolean;
  motion?: AvatarMotion | null;
}
export interface Playback {
  sourceUrl: string | null;
  mediaId: string | null;
  playing: boolean;
  position: number;
  updatedAt: number;
  revision: number;
}
export interface RoomSnapshot {
  room: RoomRecord;
  hostId: string;
  participants: Participant[];
  seats: Seat[];
  playback: Playback;
  serverNow: number;
}
export type Ack<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
export const playbackCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('media'), mediaId: z.string().uuid() }),
  z.object({
    action: z.literal('source'),
    url: z
      .string()
      .url()
      .max(2048)
      .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol)),
  }),
  z.object({ action: z.literal('play'), position: z.number().min(0).max(86400) }),
  z.object({ action: z.literal('pause'), position: z.number().min(0).max(86400) }),
  z.object({ action: z.literal('seek'), position: z.number().min(0).max(86400) }),
]);
export type PlaybackCommand = z.infer<typeof playbackCommandSchema>;
export interface MediaAsset {
  id: string;
  title: string;
  mimeType: string;
  bytes: number;
  createdAt: string;
}
export interface ClientEvents {
  'room:join': (
    input: { roomId: string; token?: string },
    ack: (value: Ack<RoomSnapshot>) => void,
  ) => void;
  'seat:claim': (seatId: string | null, ack: (value: Ack<RoomSnapshot>) => void) => void;
  'playback:command': (command: PlaybackCommand, ack: (value: Ack<RoomSnapshot>) => void) => void;
  'voice:signal': (data: { to: string; signal: unknown }) => void;
  'room:leave': () => void;
  'clock:ping': (ack: (time: number) => void) => void;
}
export interface ServerEvents {
  'room:snapshot': (snapshot: RoomSnapshot) => void;
  'voice:signal': (data: { from: string; signal: unknown }) => void;
  'session:replaced': () => void;
}
