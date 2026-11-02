import {
  generateLayout,
  seatRoute,
  motionDuration,
  type RoomRecord,
  type Participant,
  type Playback,
  type PlaybackCommand,
  type RoomSnapshot,
} from '../../../packages/shared/src/index.js';

export class RoomState {
  participants = new Map<string, Participant>();
  hostId: string;
  playback: Playback = {
    sourceUrl: null,
    mediaId: null,
    playing: false,
    position: 0,
    updatedAt: Date.now(),
    revision: 0,
  };
  watchSessionId: string | null = null;
  constructor(public room: RoomRecord) {
    this.hostId = room.ownerId;
  }
  join(person: Participant) {
    const existing = this.participants.get(person.userId);
    if (!existing && this.participants.size >= this.room.maxParticipants)
      throw new Error('Phòng đã đủ người.');
    this.participants.set(person.userId, {
      ...person,
      seatId: existing?.seatId ?? null,
      motion: existing?.motion ?? null,
      online: true,
    });
    if (person.userId === this.room.ownerId || !this.participants.get(this.hostId)?.online)
      this.hostId = person.userId;
  }
  disconnect(userId: string) {
    const person = this.participants.get(userId);
    if (person) person.online = false;
    if (this.hostId === userId)
      this.hostId = [...this.participants.values()].find((v) => v.online)?.userId ?? userId;
  }
  leave(userId: string) {
    this.disconnect(userId);
    this.participants.delete(userId);
  }
  claim(userId: string, seatId: string | null, now = Date.now()) {
    const person = this.participants.get(userId);
    if (!person?.online) throw new Error('Bạn chưa vào phòng.');
    if (person.seatId === seatId) return;
    if (person.motion && now < person.motion.startedAt + person.motion.durationMs)
      throw new Error('Nhân vật đang di chuyển. Hãy đợi đến ghế rồi đổi chỗ.');
    const layout = generateLayout(this.room);
    if (seatId !== null) {
      if (!layout.some((s) => s.id === seatId)) throw new Error('Ghế không tồn tại.');
      if ([...this.participants.values()].some((p) => p.userId !== userId && p.seatId === seatId))
        throw new Error('Ghế vừa được người khác chọn.');
    }
    const route = seatRoute(
      layout,
      layout.find((seat) => seat.id === person.seatId),
      layout.find((seat) => seat.id === seatId),
      [...this.participants.keys()].indexOf(userId),
    );
    person.seatId = seatId;
    person.motion = { path: route, startedAt: now, durationMs: motionDuration(route) };
  }
  finishMovement(userId: string, startedAt: number) {
    const person = this.participants.get(userId);
    if (person?.motion?.startedAt === startedAt) person.motion = null;
  }
  command(userId: string, command: PlaybackCommand, now = Date.now()) {
    if (userId !== this.hostId || !this.participants.get(userId)?.online)
      throw new Error('Chỉ chủ phòng được điều khiển phim.');
    if (command.action === 'source' || command.action === 'media')
      this.playback = {
        sourceUrl:
          command.action === 'media' ? `/api/media/${command.mediaId}/stream` : command.url,
        mediaId: command.action === 'media' ? command.mediaId : null,
        playing: false,
        position: 0,
        updatedAt: now,
        revision: this.playback.revision + 1,
      };
    else {
      if (!this.playback.sourceUrl) throw new Error('Hãy chọn nguồn phim trước.');
      this.playback = {
        ...this.playback,
        position: command.position,
        playing:
          command.action === 'play'
            ? true
            : command.action === 'pause'
              ? false
              : this.playback.playing,
        updatedAt: now,
        revision: this.playback.revision + 1,
      };
    }
  }
  position(now = Date.now()) {
    return (
      this.playback.position +
      (this.playback.playing ? Math.max(0, now - this.playback.updatedAt) / 1000 : 0)
    );
  }
  snapshot(): RoomSnapshot {
    return {
      room: this.room,
      hostId: this.hostId,
      participants: [...this.participants.values()],
      seats: generateLayout(this.room),
      playback: this.playback,
      serverNow: Date.now(),
    };
  }
}
