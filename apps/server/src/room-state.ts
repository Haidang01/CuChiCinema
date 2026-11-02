import {
  defaultStageSettings,
  stageSettingsSchema,
  stageSlots,
  isOnStage,
  samplePairDance,
  avatarActions,
  type StageCommand,
  type StageSettings,
  type StageSnapshot,
  type DanceInvite,
  type DancePair,
  type AvatarAction,
  type AvatarActionEvent,
  generateLayout,
  seatRoute,
  motionDuration,
  sampleMotion,
  findWalkPath,
  slideWalk,
  canStandAt,
  type RoomRecord,
  type Participant,
  type Playback,
  type PlaybackCommand,
  type RoomSnapshot,
  type Point3,
  type ChatMessage,
  type QueueItem,
  youtubeVideoId,
} from '../../../packages/shared/src/index.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const savedMediaSchema = z.object({
  version: z.literal(1),
  watchSessionId: z.string().nullable(),
  playback: z.object({
    sourceUrl: z.string().nullable(),
    mediaId: z.string().nullable(),
    playing: z.boolean(),
    position: z.number().nonnegative(),
    updatedAt: z.number().nonnegative(),
    revision: z.number().int().nonnegative(),
    title: z.string().optional(),
    kind: z.enum(['video', 'image']).optional(),
  }),
  queue: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        mediaId: z.string().nullable(),
        title: z.string(),
        addedBy: z.string(),
        addedByName: z.string(),
        votes: z.array(z.string()),
        kind: z.enum(['video', 'image']).optional(),
      }),
    )
    .max(50),
});

export class RoomState {
  stageSettings: StageSettings = { ...defaultStageSettings };
  stageSlots = new Map<string, number>();
  danceInvites = new Map<string, DanceInvite>();
  dancePairs = new Map<string, DancePair>();
  activeActions = new Map<string, AvatarActionEvent>();
  lastActionAt = new Map<string, number>();
  lastInviteAt = new Map<string, number>();
  entertainmentRevision = 0;
  restoreStage(value: unknown) {
    const parsed = stageSettingsSchema.safeParse(value);
    if (parsed.success) this.stageSettings = parsed.data;
  }
  nextStageSettings(
    userId: string,
    command: Extract<StageCommand, { action: 'configure' }>,
    now = Date.now(),
  ) {
    this.stagePerson(userId);
    if (userId !== this.hostId) throw new Error('Chỉ chủ phòng được cấu hình sân khấu.');
    if (command.revision !== this.stageSettings.revision)
      throw new Error('Cấu hình đã thay đổi. Hãy thử lại.');
    return stageSettingsSchema.parse({
      ...this.stageSettings,
      ...command.settings,
      revision: command.revision + 1,
      updatedAt: now,
    });
  }
  commitStage(settings: StageSettings) {
    this.stageSettings = settings;
    if (!settings.enabled) {
      for (const userId of [...this.participants.keys()]) this.cancelDance(userId);
      this.stageSlots.clear();
      this.danceInvites.clear();
    }
  }
  stagePerson(userId: string) {
    const person = this.participants.get(userId);
    if (!person?.online) throw new Error('Bạn chưa vào phòng.');
    return person;
  }
  readyDancer(userId: string) {
    const person = this.stagePerson(userId);
    if (!this.stageSettings.enabled) throw new Error('Chủ phòng cần bật sân khấu trước.');
    if (person.seatId || person.motion || person.walking || !isOnStage(person.position))
      throw new Error('Cả hai cần đứng yên trên sân khấu trước khi khiêu vũ.');
    if ([...this.dancePairs.values()].some((pair) => pair.users.includes(userId)))
      throw new Error('Nhân vật đang khiêu vũ. Hãy dừng điệu nhảy trước.');
    return person;
  }
  cancelDance(userId: string) {
    let changed = this.activeActions.delete(userId);
    for (const [id, pair] of this.dancePairs)
      if (pair.users.includes(userId)) {
        this.dancePairs.delete(id);
        pair.users.forEach((user) => this.activeActions.delete(user));
        changed = true;
      }
    for (const [id, invite] of this.danceInvites)
      if (invite.from === userId || invite.to === userId) {
        this.danceInvites.delete(id);
        changed = true;
      }
    if (changed) this.entertainmentRevision++;
    return changed;
  }
  pruneEntertainment(now = Date.now()) {
    let changed = false;
    for (const [id, invite] of this.danceInvites)
      if (invite.expiresAt <= now) {
        this.danceInvites.delete(id);
        changed = true;
      }
    for (const pair of [...this.dancePairs.values()])
      if (pair.endsAt <= now) {
        this.cancelDance(pair.users[0]);
        changed = true;
      }
    for (const [user, action] of this.activeActions)
      if (action.at + action.duration <= now) {
        this.activeActions.delete(user);
        changed = true;
      }
    return changed;
  }
  performAction(userId: string, actionId: AvatarAction, now = Date.now()) {
    const person = this.stagePerson(userId);
    const action = avatarActions.find((item) => item.id === actionId);
    if (!action || action.pairedOnly) throw new Error('Khiêu vũ đôi cần lời mời được chấp nhận.');
    if ([...this.dancePairs.values()].some((pair) => pair.users.includes(userId)))
      throw new Error('Dừng khiêu vũ đôi trước khi chọn động tác khác.');
    if (now - (this.lastActionAt.get(userId) ?? -Infinity) < 1400)
      throw new Error('Chờ một chút trước khi thực hiện hành động tiếp.');
    if (action.seatedOnly && !person.seatId) throw new Error('Hãy chọn ghế để dùng hành động này.');
    if (action.standingOnly && (person.seatId || person.walking || person.motion))
      throw new Error('Đứng lên và dừng di chuyển để thực hiện động tác này.');
    this.lastActionAt.set(userId, now);
    const event = { userId, action: action.id, at: now, duration: action.duration };
    this.activeActions.set(userId, event);
    return event;
  }
  handleStage(
    userId: string,
    command: Exclude<StageCommand, { action: 'configure' }>,
    now = Date.now(),
  ) {
    const person = this.stagePerson(userId);
    this.pruneEntertainment(now);
    if (command.action === 'stop') {
      this.cancelDance(userId);
      return;
    }
    if (command.action === 'leave') {
      if (person.seatId || person.motion) throw new Error('Đứng lên và đợi nhân vật dừng trước.');
      this.walk(userId, 0, -0.65, now);
      this.stageSlots.delete(userId);
      return;
    }
    if (command.action === 'enter') {
      if (!this.stageSettings.enabled) throw new Error('Chủ phòng cần bật sân khấu trước.');
      if (person.seatId || person.motion)
        throw new Error('Đứng lên và đợi nhân vật dừng trước khi lên sân khấu.');
      const slot =
        this.stageSlots.get(userId) ??
        stageSlots.findIndex((_, index) => ![...this.stageSlots.values()].includes(index));
      if (slot < 0) throw new Error('Sân khấu đủ 8 người. Hãy đợi một chỗ trống.');
      const point = stageSlots[slot]!;
      this.walk(userId, point[0], point[2], now);
      this.stageSlots.set(userId, slot);
      return;
    }
    if (command.action === 'invite') {
      if (command.to === userId) throw new Error('Hãy chọn một người khác.');
      this.readyDancer(userId);
      this.readyDancer(command.to);
      if (now - (this.lastInviteAt.get(userId) ?? -Infinity) < 5000)
        throw new Error('Chờ một chút trước khi gửi lời mời tiếp.');
      if (
        [...this.danceInvites.values()].some((invite) =>
          [invite.from, invite.to].some((user) => user === userId || user === command.to),
        )
      )
        throw new Error('Một trong hai người đang có lời mời chờ trả lời.');
      this.lastInviteAt.set(userId, now);
      const invite = {
        id: randomUUID(),
        from: userId,
        to: command.to,
        style: command.style,
        expiresAt: now + 20000,
      };
      this.danceInvites.set(invite.id, invite);
      return;
    }
    const invite = this.danceInvites.get(command.id);
    if (!invite || invite.to !== userId || invite.expiresAt <= now)
      throw new Error('Lời mời không hợp lệ hoặc đã hết hạn.');
    if (!command.accept) {
      this.danceInvites.delete(invite.id);
      return;
    }
    const from = this.readyDancer(invite.from),
      to = this.readyDancer(invite.to);
    const a = from.position!,
      b = to.position!;
    if (Math.hypot(a[0] - b[0], a[2] - b[2]) > 3)
      throw new Error('Hai người cần đứng gần nhau hơn trên sân khấu.');
    const center: Point3 = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2];
    if (
      [...this.dancePairs.values()].some(
        (pair) => Math.hypot(center[0] - pair.center[0], center[2] - pair.center[2]) < 1.3,
      )
    )
      throw new Error('Vị trí này gần một cặp đang nhảy. Hãy chọn chỗ trống.');
    const pair: DancePair = {
      id: randomUUID(),
      users: [invite.from, invite.to],
      style: invite.style,
      startedAt: now,
      endsAt: now + 20000,
      center,
    };
    this.danceInvites.delete(invite.id);
    this.dancePairs.set(pair.id, pair);
    pair.users.forEach((user, index) => {
      const dancer = this.stagePerson(user);
      this.inputs.delete(user);
      dancer.motion = null;
      dancer.walking = false;
      const pose = samplePairDance(pair, user, now);
      dancer.position = pose.position;
      dancer.yaw = pose.yaw;
      this.activeActions.set(user, {
        userId: user,
        action: pair.style === 'waltz' ? 'duet_waltz' : 'duet_salsa',
        at: now,
        duration: 20000,
        partnerId: pair.users[1 - index],
        role: index as 0 | 1,
      });
    });
    this.avatarRevision++;
  }
  stageSnapshot(): StageSnapshot {
    return {
      settings: this.stageSettings,
      invites: [...this.danceInvites.values()],
      pairs: [...this.dancePairs.values()],
      slots: Object.fromEntries(this.stageSlots),
    };
  }

  savedMedia() {
    return savedMediaSchema.parse({
      version: 1,
      playback: this.playback,
      queue: this.queue,
      watchSessionId: this.watchSessionId,
    });
  }
  restoreMedia(value: unknown) {
    const saved = savedMediaSchema.safeParse(value);
    if (!saved.success) return;
    this.playback = saved.data.playback;
    this.queue = saved.data.queue;
    this.watchSessionId = saved.data.watchSessionId;
  }
  participants = new Map<string, Participant>();
  hostId: string;
  avatarRevision = 0;
  chat: ChatMessage[] = [];
  queue: QueueItem[] = [];
  enqueue(
    userId: string,
    url: string,
    title?: string,
    mediaId: string | null = null,
    kind: 'video' | 'image' = 'video',
  ) {
    const person = this.participants.get(userId);
    if (!person?.online) throw new Error('Bạn chưa vào phòng.');
    if (this.queue.length >= 50) throw new Error('Hàng chờ đã đủ 50 video.');
    const videoId = youtubeVideoId(url);
    const canonical = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url;
    if (this.queue.some((item) => item.url === canonical))
      throw new Error('Video đã có trong hàng chờ.');
    this.queue.push({
      kind,
      id: randomUUID(),
      url: canonical,
      mediaId,
      title:
        title ||
        (videoId
          ? `YouTube · ${videoId}`
          : new URL(url, 'http://localhost').pathname.split('/').pop() || 'Video'),
      addedBy: userId,
      addedByName: person.name,
      votes: [],
    });
  }
  editQueue(userId: string, action: 'vote' | 'remove', id: string) {
    if (!this.participants.get(userId)?.online) throw new Error('Bạn chưa vào phòng.');
    const item = this.queue.find((item) => item.id === id);
    if (!item) throw new Error('Video không còn trong hàng chờ.');
    if (action === 'remove') {
      if (userId !== this.hostId && userId !== item.addedBy)
        throw new Error('Chỉ chủ phòng hoặc người gửi được xóa video.');
      this.queue = this.queue.filter((entry) => entry.id !== id);
    } else {
      item.votes = item.votes.includes(userId)
        ? item.votes.filter((id) => id !== userId)
        : [...item.votes, userId];
      this.queue.sort((a, b) => b.votes.length - a.votes.length);
    }
  }
  nextQueued(userId: string, revision: number) {
    if (userId !== this.hostId || !this.participants.get(userId)?.online)
      throw new Error('Chỉ chủ phòng được chuyển video.');
    if (revision !== this.playback.revision) throw new Error('Phim đã thay đổi. Hãy thử lại.');
    const item = this.queue[0];
    if (!item) throw new Error('Hàng chờ đang trống.');
    return item;
  }
  startQueued(userId: string, revision: number, now = Date.now()) {
    const item = this.nextQueued(userId, revision);
    this.command(
      userId,
      item.mediaId
        ? { action: 'media', mediaId: item.mediaId }
        : { action: 'source', url: item.url },
      now,
    );
    this.playback.title = item.title;
    this.playback.kind = item.kind ?? 'video';
    this.queue.shift();
    if (item.kind !== 'image') this.command(userId, { action: 'play', position: 0 }, now);
  }
  inputs = new Map<string, { x: number; z: number; at: number }>();
  lastChat = new Map<string, number>();
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
      position: existing?.position ?? [
        (([...this.participants.keys()].length % 3) - 1) * 0.2,
        Math.max(...generateLayout(this.room).map((seat) => seat.y)),
        Math.max(...generateLayout(this.room).map((seat) => seat.z)) + 2.1,
      ],
      yaw: existing?.yaw ?? Math.PI,
      walking: false,
      online: true,
    });
    if (person.userId === this.room.ownerId || !this.participants.get(this.hostId)?.online)
      this.hostId = person.userId;
  }
  disconnect(userId: string) {
    this.cancelDance(userId);
    this.stageSlots.delete(userId);
    const person = this.participants.get(userId);
    if (person) person.online = false;
    this.inputs.delete(userId);
    if (person) person.walking = false;
    if (this.hostId === userId)
      this.hostId = [...this.participants.values()].find((v) => v.online)?.userId ?? userId;
  }
  leave(userId: string) {
    this.disconnect(userId);
    this.participants.delete(userId);
    this.lastChat.delete(userId);
    this.lastActionAt.delete(userId);
    this.lastInviteAt.delete(userId);
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
    let route = seatRoute(
      layout,
      layout.find((seat) => seat.id === person.seatId),
      layout.find((seat) => seat.id === seatId),
      [...this.participants.keys()].indexOf(userId),
    );
    if (!person.seatId && seatId && person.position) {
      const target = layout.find((seat) => seat.id === seatId)!;
      const approach: Point3 = [target.x, 0, target.z - 1];
      const path = findWalkPath(layout, person.position, approach);
      if (!path) throw new Error('Chưa tìm được lối tới ghế. Hãy di chuyển ra lối đi rồi thử lại.');
      route = [...path, [target.x, target.y + 0.45, target.z]];
    }
    this.inputs.delete(userId);
    this.cancelDance(userId);
    this.stageSlots.delete(userId);
    person.seatId = seatId;
    person.motion = {
      kind: 'seat',
      path: route,
      startedAt: now,
      durationMs: motionDuration(route),
    };
    person.walking = true;
    this.avatarRevision++;
  }
  finishMovement(userId: string, startedAt: number) {
    const person = this.participants.get(userId);
    if (person?.motion?.startedAt === startedAt) {
      person.position = person.motion.path.at(-1)!;
      person.motion = null;
      person.walking = false;
      person.yaw = this.stageSlots.has(userId) ? 0 : Math.PI;
      this.avatarRevision++;
    }
  }
  setInput(userId: string, x: number, z: number, now = Date.now()) {
    const person = this.participants.get(userId);
    if (!person?.online || person.seatId) return;
    if (person.motion) {
      if (person.motion.kind !== 'walk') return;
      const current = sampleMotion(person.motion, now).position;
      if (!canStandAt(generateLayout(this.room), current[0], current[2])) return;
      person.position = current;
      person.motion = null;
    }
    if (Math.hypot(x, z) > 0.08) {
      this.cancelDance(userId);
      this.stageSlots.delete(userId);
    }
    this.inputs.set(userId, { x, z, at: now });
  }
  walk(userId: string, x: number, z: number, now = Date.now()) {
    const person = this.participants.get(userId);
    if (!person?.online) throw new Error('Bạn chưa vào phòng.');
    if (person.seatId || (person.motion && person.motion.kind !== 'walk'))
      throw new Error('Bấm Đứng lên và đợi ra lối đi trước khi di chuyển.');
    const from = person.motion ? sampleMotion(person.motion, now).position : person.position!;
    const path = findWalkPath(generateLayout(this.room), from, [x, 0, z]);
    if (!path) throw new Error('Điểm này bị ghế hoặc tường chắn. Hãy chọn chỗ trống trên sàn.');
    this.inputs.delete(userId);
    this.cancelDance(userId);
    this.stageSlots.delete(userId);
    person.position = from;
    person.walking = true;
    person.motion = { kind: 'walk', path, startedAt: now, durationMs: motionDuration(path) };
    this.avatarRevision++;
  }
  tickMovement(delta: number, now = Date.now()) {
    let changed = false;
    const seats = generateLayout(this.room);
    for (const person of this.participants.values()) {
      const pair = [...this.dancePairs.values()].find(
        (pair) => pair.endsAt > now && pair.users.includes(person.userId),
      );
      if (pair) {
        const pose = samplePairDance(pair, person.userId, now);
        person.position = pose.position;
        person.yaw = pose.yaw;
        person.walking = false;
        changed = true;
        continue;
      }
      if (person.motion) {
        if (now >= person.motion.startedAt + person.motion.durationMs) {
          this.finishMovement(person.userId, person.motion.startedAt);
          changed = true;
        }
        continue;
      }
      const input = this.inputs.get(person.userId);
      const fresh = person.online && input && now - input.at < 350 && !person.seatId;
      const magnitude = fresh ? Math.hypot(input.x, input.z) : 0;
      const old = person.position!;
      const next = magnitude
        ? slideWalk(
            seats,
            old,
            (input!.x / Math.max(1, magnitude)) * 2.4 * Math.min(0.1, Math.max(0, delta)),
            (input!.z / Math.max(1, magnitude)) * 2.4 * Math.min(0.1, Math.max(0, delta)),
          )
        : old;
      const walking = next[0] !== old[0] || next[2] !== old[2];
      if (walking || person.walking !== walking) {
        person.position = next;
        person.walking = walking;
        if (walking) person.yaw = Math.atan2(next[0] - old[0], next[2] - old[2]);
        changed = true;
      }
    }
    if (changed) this.avatarRevision++;
    return changed;
  }
  sendChat(userId: string, text: string, now = Date.now()) {
    const person = this.participants.get(userId);
    if (!person?.online) throw new Error('Bạn chưa vào phòng.');
    if (now - (this.lastChat.get(userId) ?? -Infinity) < 800)
      throw new Error('Chờ một chút trước khi gửi tiếp.');
    this.lastChat.set(userId, now);
    const message = { id: randomUUID(), userId, name: person.name, text, at: now };
    this.chat.push(message);
    if (this.chat.length > 60) this.chat.shift();
    return message;
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
      if (this.playback.kind === 'image' && command.action !== 'pause')
        throw new Error('Ảnh đang chiếu. Chọn Bài tiếp theo để đổi nội dung.');
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
      stage: this.stageSnapshot(),
      actions: [...this.activeActions.values()],
      room: this.room,
      hostId: this.hostId,
      participants: [...this.participants.values()],
      seats: generateLayout(this.room),
      playback: this.playback,
      serverNow: Date.now(),
      avatarRevision: this.avatarRevision,
      chat: this.chat,
      queue: this.queue,
    };
  }
}
