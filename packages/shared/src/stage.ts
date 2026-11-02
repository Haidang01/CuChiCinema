import { z } from 'zod';
import type { Point3 } from './navigation.js';

export const stageOptionsSchema = z.object({
  enabled: z.boolean(),
  lighting: z.enum(['cinema', 'bar', 'concert']),
  beams: z.boolean(),
  fireworks: z.boolean(),
  intensity: z.number().min(0.2).max(1),
});
export const stageSettingsSchema = stageOptionsSchema.extend({
  revision: z.number().int().nonnegative(),
  updatedAt: z.number().nonnegative(),
});
export type StageSettings = z.infer<typeof stageSettingsSchema>;
export const defaultStageSettings: StageSettings = {
  enabled: false,
  lighting: 'cinema',
  beams: true,
  fireworks: false,
  intensity: 0.65,
  revision: 0,
  updatedAt: 0,
};
export const danceStyleSchema = z.enum(['waltz', 'salsa']);
export type DanceStyle = z.infer<typeof danceStyleSchema>;
export const stageCommandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('configure'),
    revision: z.number().int().nonnegative(),
    settings: stageOptionsSchema.partial().refine((value) => Object.keys(value).length > 0),
  }),
  z.object({ action: z.literal('enter') }),
  z.object({ action: z.literal('leave') }),
  z.object({ action: z.literal('stop') }),
  z.object({ action: z.literal('invite'), to: z.string().min(1).max(64), style: danceStyleSchema }),
  z.object({ action: z.literal('respond'), id: z.string().uuid(), accept: z.boolean() }),
]);
export type StageCommand = z.infer<typeof stageCommandSchema>;
export interface DanceInvite {
  id: string;
  from: string;
  to: string;
  style: DanceStyle;
  expiresAt: number;
}
export interface DancePair {
  id: string;
  users: [string, string];
  style: DanceStyle;
  startedAt: number;
  endsAt: number;
  center: Point3;
}
export interface StageSnapshot {
  settings: StageSettings;
  invites: DanceInvite[];
  pairs: DancePair[];
  slots: Record<string, number>;
}
export const stageSlots: Point3[] = Array.from({ length: 8 }, (_, index) => [
  -2.1 + (index % 4) * 1.4,
  0,
  -2.9 + Math.floor(index / 4) * 1.4,
]);
export function isOnStage(position?: Point3) {
  return !!position && Math.abs(position[0]) <= 2.8 && position[2] >= -3.4 && position[2] <= -1.05;
}
export function samplePairDance(pair: DancePair, userId: string, now: number) {
  const index = pair.users.indexOf(userId);
  const elapsed = Math.max(0, Math.min(now, pair.endsAt) - pair.startedAt) / 1000;
  const angle = elapsed * (pair.style === 'waltz' ? 0.65 : 0.35) + index * Math.PI;
  const radius = pair.style === 'waltz' ? 0.37 : 0.43;
  const x = Math.cos(angle) * radius,
    z = Math.sin(angle) * radius;
  return {
    position: [pair.center[0] + x, pair.center[1], pair.center[2] + z] as Point3,
    yaw: Math.atan2(-x, -z),
  };
}
