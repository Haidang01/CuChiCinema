export {
  stageCommandSchema,
  stageSettingsSchema,
  defaultStageSettings,
  stageSlots,
  isOnStage,
  samplePairDance,
} from './stage.js';
export type {
  StageCommand,
  StageSettings,
  StageSnapshot,
  DanceInvite,
  DancePair,
  DanceStyle,
} from './stage.js';
import type { StageCommand, StageSnapshot } from './stage.js';
export { avatarActionSchema, avatarActions } from './actions.js';
export type { AvatarAction, AvatarActionEvent } from './actions.js';
import type { AvatarAction, AvatarActionEvent } from './actions.js';
import { z } from 'zod';
export { youtubeVideoId } from './youtube.js';
export { seatRoute, motionDuration, sampleMotion } from './navigation.js';
export {
  floorHeight,
  walkBounds,
  canStandAt,
  clearWalkSegment,
  slideWalk,
  findWalkPath,
} from './navigation.js';
export type { AvatarMotion, Point3 } from './navigation.js';
import type { AvatarMotion, Point3 } from './navigation.js';

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
    chairStyle: z.enum(['classic', 'recliner', 'club', 'retro', 'pod', 'sofa']).default('classic'),
    chairColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#4e3644'),
    wallColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#20232d'),
    seatOverrides: z
      .array(
        z.object({
          seatId: z.string().max(8),
          kind: z.enum(['standard', 'vip', 'loveseat']),
        }),
      )
      .max(300)
      .default([]),
    seatsPerRow: z.number().int().min(2).max(20).optional(),
    rowSpacing: z.number().min(2).max(3.5).optional(),
    rowRise: z.number().min(0).max(0.6).optional(),
    capacity: z.number().int().min(2).max(300),
    maxParticipants: z.number().int().min(2).max(300),
  })
  .refine((v) => v.maxParticipants <= v.capacity, {
    message: 'Số người tham gia không được vượt số chỗ ngồi.',
    path: ['maxParticipants'],
  });
export type RoomConfig = z.infer<typeof roomSchema>;
export type RoomConfigInput = z.input<typeof roomSchema>;
export type Seat = {
  id: string;
  groupId: string;
  index: number;
  x: number;
  z: number;
  y: number;
  kind: 'standard' | 'vip' | 'loveseat';
  row: number;
  rowLabel: string;
  zone: 'left' | 'center-left' | 'center-right' | 'right';
};
export function generateLayout(config: RoomConfigInput): Seat[] {
  roomSchema.parse(config);
  const columns = Math.min(config.seatsPerRow ?? 4, config.capacity);
  const spacing = config.rowSpacing ?? 2.2,
    rise = config.rowRise ?? 0.18;
  const pair = config.type === 'couple' || config.type === 'lounge';
  const label = (row: number): string =>
    row < 26
      ? String.fromCharCode(65 + row)
      : label(Math.floor(row / 26) - 1) + String.fromCharCode(65 + (row % 26));
  const overrides = new Map(
    (config.seatOverrides ?? []).map((entry) => [entry.seatId, entry.kind]),
  );
  // Allocate whole pairs so a loveseat never straddles an aisle.
  const unitSlots = pair ? 2 : 1;
  const zoneWidths = (count: number) => {
    const units = pair ? Math.ceil(count / 2) : count;
    const outer = units >= 4 ? Math.max(1, Math.round(units * 0.16)) : 0;
    const inner = units - outer * 2;
    return [outer, Math.ceil(inner / 2), Math.floor(inner / 2), outer].map(
      (value) => value * unitSlots,
    );
  };
  const widths = zoneWidths(columns);
  const seatSpacing = 1.3;
  const zoneStarts = (rowWidths: number[]) => {
    const innerLeft = -1.6 - (rowWidths[1]! - 1) * seatSpacing;
    return [
      innerLeft - 1.8 - (rowWidths[0]! - 1) * seatSpacing,
      innerLeft,
      1.6,
      1.6 + (rowWidths[2]! - 1) * seatSpacing + 1.8,
    ];
  };
  return Array.from({ length: config.capacity }, (_, i) => {
    const row = Math.floor(i / columns),
      col = i % columns;
    const rowSize = Math.min(columns, config.capacity - row * columns);
    const rowWidths = rowSize === columns ? widths : zoneWidths(rowSize);
    const starts = zoneStarts(rowWidths);
    const rowPositions = Array.from({ length: rowSize }, (_, rowCol) => {
      let zone = 0;
      let offset = rowCol;
      while (zone < 3 && offset >= rowWidths[zone]!) {
        offset -= rowWidths[zone]!;
        zone++;
      }
      return { zone, offset, x: starts[zone]! + offset * seatSpacing };
    });
    const rowCenterOffset = rowPositions.reduce((sum, position) => sum + position.x, 0) / rowSize;
    const { zone, offset, x } = rowPositions[col]!;
    const id = label(row) + (col + 1);
    const override = overrides.get(id);
    const zoneStart = rowWidths.slice(0, zone).reduce((sum, width) => sum + width, 0);
    const partnerCol = zoneStart + (offset % 2 === 0 ? offset + 1 : offset - 1);
    const pairable =
      partnerCol >= zoneStart && partnerCol < rowSize && partnerCol < zoneStart + rowWidths[zone]!;
    const hasPair = pair && (col % 2 === 1 || col + 1 < rowSize);
    const zoneName = (['left', 'center-left', 'center-right', 'right'] as const)[zone]!;
    const overriddenPair =
      override === 'loveseat' || overrides.get(label(row) + (partnerCol + 1)) === 'loveseat';
    return {
      id,
      groupId:
        overriddenPair && pairable
          ? 'r' + row + '-love-' + Math.min(col, partnerCol)
          : pair
            ? 'r' + row + '-g' + Math.floor(col / 2)
            : 'g' + i,
      index: i,
      x: x - rowCenterOffset,
      z: row * spacing,
      y: row * rise,
      row,
      rowLabel: label(row),
      zone: zoneName,
      kind:
        overriddenPair && pairable
          ? 'loveseat'
          : (override ??
            (hasPair
              ? 'loveseat'
              : pair
                ? 'standard'
                : zone === 1 || zone === 2
                  ? 'vip'
                  : 'standard')),
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
  chairStyle?: RoomConfig['chairStyle'];
  chairColor?: string;
  wallColor?: string;
  seatOverrides?: RoomConfig['seatOverrides'];
  capacity: number;
  maxParticipants: number;
  ownerId: string;
  createdAt: string;
  seatsPerRow?: number;
  rowSpacing?: number;
  rowRise?: number;
}
export interface Participant {
  userId: string;
  name: string;
  appearance: Appearance;
  seatId: string | null;
  online: boolean;
  motion?: AvatarMotion | null;
  position?: Point3;
  yaw?: number;
  walking?: boolean;
}
export interface Playback {
  title?: string;
  kind?: 'video' | 'image';
  sourceUrl: string | null;
  mediaId: string | null;
  playing: boolean;
  position: number;
  updatedAt: number;
  revision: number;
}
export interface QueueItem {
  id: string;
  url: string;
  mediaId: string | null;
  title: string;
  addedBy: string;
  addedByName: string;
  votes: string[];
  kind?: 'video' | 'image';
}
export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
}
export interface ReactionEvent {
  userId: string;
  emoji: string;
  at: number;
}
export interface RoomSnapshot {
  stage: StageSnapshot;
  actions: AvatarActionEvent[];
  queue: QueueItem[];
  avatarRevision: number;
  chat: ChatMessage[];
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
  'stage:command': (command: StageCommand, ack: (value: Ack<RoomSnapshot>) => void) => void;
  'character:refresh': (ack: (value: Ack<RoomSnapshot>) => void) => void;
  'queue:command': (command: QueueCommand, ack: (value: Ack<RoomSnapshot>) => void) => void;
  'avatar:input': (input: { x: number; z: number }) => void;
  'avatar:walk': (
    target: { x: number; z: number },
    ack: (value: Ack<RoomSnapshot>) => void,
  ) => void;
  'chat:send': (text: string, ack: (value: Ack<ChatMessage>) => void) => void;
  'avatar:action': (action: AvatarAction, ack: (value: Ack<AvatarActionEvent>) => void) => void;
  'reaction:send': (emoji: string, ack: (value: Ack<ReactionEvent>) => void) => void;
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
  'avatars:update': (update: AvatarUpdate) => void;
  'chat:message': (message: ChatMessage) => void;
  'avatar:action': (action: AvatarActionEvent) => void;
  'reaction:play': (reaction: ReactionEvent) => void;
  'room:snapshot': (snapshot: RoomSnapshot) => void;
  'voice:signal': (data: { from: string; signal: unknown }) => void;
  'session:replaced': () => void;
}

export interface AvatarUpdate {
  roomId: string;
  revision: number;
  participants: Pick<Participant, 'userId' | 'position' | 'yaw' | 'walking' | 'motion'>[];
}
export const queueCommandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add'),
    url: z
      .string()
      .url()
      .max(2048)
      .refine((v) => ['http:', 'https:'].includes(new URL(v).protocol)),
    title: z.string().trim().max(120).optional(),
  }),
  z.object({ action: z.literal('media'), mediaId: z.string().uuid() }),
  z.object({ action: z.literal('vote'), id: z.string().uuid() }),
  z.object({ action: z.literal('remove'), id: z.string().uuid() }),
  z.object({ action: z.literal('next'), revision: z.number().int().min(0) }),
]);
export type QueueCommand = z.infer<typeof queueCommandSchema>;
