import { z } from 'zod';
export const avatarActionSchema = z.enum([
  'wave',
  'nod',
  'clap',
  'cheer',
  'dance',
  'dance_hiphop',
  'dance_shuffle',
  'dance_salsa',
  'dance_disco',
  'dance_ballet',
  'duet_waltz',
  'duet_salsa',
  'jump',
  'talk',
  'laugh',
  'stretch',
  'lean',
  'whisper',
  'sleep',
  'eat_popcorn',
  'drink',
  'throw_popcorn',
]);
export type AvatarAction = z.infer<typeof avatarActionSchema>;
export const avatarActions: {
  id: AvatarAction;
  label: string;
  icon: string;
  duration: number;
  standingOnly: boolean;
  seatedOnly?: boolean;
  pairedOnly?: boolean;
}[] = [
  { id: 'wave', label: 'Vẫy tay', icon: '👋', duration: 2800, standingOnly: false },
  { id: 'nod', label: 'Gật đầu', icon: '🙂', duration: 2000, standingOnly: false },
  { id: 'clap', label: 'Vỗ tay', icon: '👏', duration: 3000, standingOnly: false },
  { id: 'cheer', label: 'Hoan hô', icon: '🙌', duration: 2600, standingOnly: false },
  { id: 'dance', label: 'Nhún nhảy', icon: '🕺', duration: 4000, standingOnly: true },
  ...(
    [
      ['dance_hiphop', 'Hip-hop', '🎧'],
      ['dance_shuffle', 'Shuffle', '👟'],
      ['dance_salsa', 'Salsa', '💃'],
      ['dance_disco', 'Disco', '🪩'],
      ['dance_ballet', 'Ballet', '🩰'],
    ] as const
  ).map(([id, label, icon]) => ({ id, label, icon, duration: 16000, standingOnly: true })),
  {
    id: 'duet_waltz',
    label: 'Waltz đôi',
    icon: '🤝',
    duration: 20000,
    standingOnly: true,
    pairedOnly: true,
  },
  {
    id: 'duet_salsa',
    label: 'Salsa đôi',
    icon: '💞',
    duration: 20000,
    standingOnly: true,
    pairedOnly: true,
  },
  { id: 'jump', label: 'Nhảy lên', icon: '🤸', duration: 2200, standingOnly: true },
  { id: 'talk', label: 'Trò chuyện', icon: '💬', duration: 4200, standingOnly: false },
  { id: 'laugh', label: 'Cười vui', icon: '😄', duration: 2800, standingOnly: false },
  { id: 'stretch', label: 'Vươn vai', icon: '🙆', duration: 3200, standingOnly: false },
  {
    id: 'lean',
    label: 'Tựa lưng thư giãn',
    icon: '😌',
    duration: 3600,
    standingOnly: false,
    seatedOnly: true,
  },
  {
    id: 'whisper',
    label: 'Nghiêng người trò chuyện',
    icon: '🤫',
    duration: 3000,
    standingOnly: false,
    seatedOnly: true,
  },
  {
    id: 'sleep',
    label: 'Ngủ gật',
    icon: '😴',
    duration: 4200,
    standingOnly: false,
    seatedOnly: true,
  },
];
export interface AvatarActionEvent {
  userId: string;
  action: AvatarAction;
  at: number;
  duration: number;
  partnerId?: string;
  role?: 0 | 1;
}
