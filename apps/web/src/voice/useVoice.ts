import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ClientEvents, Participant, ServerEvents } from '@cineverse/shared';
import { api } from '../api';
type Peer = {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  makingOffer: boolean;
  ignoreOffer: boolean;
  settingAnswer: boolean;
  pending: RTCIceCandidateInit[];
};
type Signal = { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
export function useVoice(
  socket: Socket<ServerEvents, ClientEvents> | null,
  userId: string,
  participants: Participant[],
  notify: (message: string) => void,
) {
  const peers = useRef(new Map<string, Peer>());
  const stream = useRef<MediaStream | null>(null);
  const ice = useRef<RTCIceServer[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [inputId, setInputId] = useState('');
  const [outputId, setOutputId] = useState('');
  const output = useRef('');
  const iceReady = useRef<Promise<void>>(Promise.resolve());
  const [connections, setConnections] = useState(0);
  const active = useRef(true);
  const generation = useRef(0);
  const deaf = useRef(false);
  const cleanup = useCallback(() => {
    generation.current++;
    for (const { pc, audio } of peers.current.values()) {
      pc.close();
      audio.pause();
      audio.srcObject = null;
    }
    peers.current.clear();
    setConnections(0);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setEnabled(false);
  }, []);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      cleanup();
    };
  }, [cleanup]);
  const createPeer = useCallback(
    (id: string) => {
      const existing = peers.current.get(id);
      if (existing) return existing;
      if (!socket) throw new Error('Chưa có kết nối phòng.');
      const pc = new RTCPeerConnection({ iceServers: ice.current });
      const audio = new Audio();
      audio.autoplay = true;
      audio.muted = deaf.current;
      if (output.current && typeof audio.setSinkId === 'function')
        void audio
          .setSinkId(output.current)
          .catch(() => notify('Không chọn được loa. Kiểm tra quyền thiết bị âm thanh.'));
      const peer: Peer = {
        pc,
        audio,
        makingOffer: false,
        ignoreOffer: false,
        settingAnswer: false,
        pending: [],
      };
      peers.current.set(id, peer);
      pc.onicecandidate = (event) => {
        if (event.candidate)
          socket.emit('voice:signal', { to: id, signal: { candidate: event.candidate.toJSON() } });
      };
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio
          .play()
          .catch(() => notify('Trình duyệt chặn âm thanh. Bấm nút loa để cho phép nghe.'));
      };
      pc.onconnectionstatechange = () => {
        setConnections(
          [...peers.current.values()].filter((peer) => peer.pc.connectionState === 'connected')
            .length,
        );
        if (pc.connectionState === 'failed')
          notify('Voice chưa kết nối được. Thử bật lại mic; mạng ngoài có thể cần TURN.');
      };
      pc.onnegotiationneeded = async () => {
        try {
          peer.makingOffer = true;
          await pc.setLocalDescription();
          socket.emit('voice:signal', {
            to: id,
            signal: { description: pc.localDescription?.toJSON() },
          });
        } catch {
          if (pc.signalingState !== 'closed')
            notify('Không thể thương lượng voice. Hãy thử bật lại mic.');
        } finally {
          peer.makingOffer = false;
        }
      };
      if (stream.current)
        for (const track of stream.current.getTracks()) pc.addTrack(track, stream.current);
      return peer;
    },
    [socket, notify],
  );
  useEffect(() => {
    if (!socket) return;
    let cancelled = false;
    const settings = api<{ iceServers: RTCIceServer[] }>('/voice/ice').then((result) => {
      if (!cancelled) ice.current = result.iceServers;
    });
    iceReady.current = settings;
    const handler = async ({ from, signal }: { from: string; signal: unknown }) => {
      try {
        await settings;
        if (cancelled) return;
        const data = signal as Signal;
        if (!data || typeof data !== 'object') return;
        const peer = createPeer(from);
        const pc = peer.pc;
        if (data.description) {
          const ready = !peer.makingOffer && (pc.signalingState === 'stable' || peer.settingAnswer);
          const collision = data.description.type === 'offer' && !ready;
          peer.ignoreOffer = userId < from && collision;
          if (peer.ignoreOffer) return;
          peer.settingAnswer = data.description.type === 'answer';
          await pc.setRemoteDescription(data.description);
          peer.settingAnswer = false;
          for (const candidate of peer.pending.splice(0)) await pc.addIceCandidate(candidate);
          if (data.description.type === 'offer') {
            await pc.setLocalDescription();
            socket.emit('voice:signal', {
              to: from,
              signal: { description: pc.localDescription?.toJSON() },
            });
          }
        } else if (data.candidate && !peer.ignoreOffer) {
          if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
          else peer.pending.push(data.candidate);
        }
      } catch {
        if (!cancelled) notify('Voice gặp lỗi kết nối. Hãy thử tắt và bật lại mic.');
      }
    };
    void settings.catch(() => notify('Không tải được cấu hình voice.'));
    const reset = () => cleanup();
    socket.on('voice:signal', handler);
    socket.on('disconnect', reset);
    return () => {
      cancelled = true;
      socket.off('voice:signal', handler);
      socket.off('disconnect', reset);
      cleanup();
    };
  }, [socket, userId, createPeer, notify, cleanup]);
  useEffect(() => {
    const online = new Set(
      participants.filter((p) => p.online && p.userId !== userId).map((p) => p.userId),
    );
    for (const [id, peer] of peers.current)
      if (!online.has(id)) {
        peer.pc.close();
        peer.audio.pause();
        peer.audio.srcObject = null;
        peers.current.delete(id);
      }
    if (enabled) for (const id of online) createPeer(id);
  }, [participants, userId, enabled, createPeer]);
  async function toggleMic() {
    if (busy) return;
    if (enabled) {
      stream.current?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      setEnabled(false);
      return;
    }
    setBusy(true);
    const current = generation.current;
    try {
      await iceReady.current;
      if (!active.current || current !== generation.current) return;
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error('Micro cần HTTPS hoặc localhost và trình duyệt hỗ trợ.');
      if (!stream.current) {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            ...(inputId ? { deviceId: { exact: inputId } } : {}),
          },
          video: false,
        });
        if (!active.current || current !== generation.current) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        for (const peer of peers.current.values())
          for (const track of media.getTracks()) peer.pc.addTrack(track, media);
      }
      stream.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      setEnabled(true);
      const available = await navigator.mediaDevices.enumerateDevices();
      if (!active.current || current !== generation.current) return;
      setDevices(available);
      for (const p of participants) if (p.online && p.userId !== userId) createPeer(p.userId);
    } catch (e) {
      notify(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Quyền micro bị từ chối. Cho phép micro trong cài đặt trình duyệt.'
          : (e as Error).message,
      );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function changeInput(id: string) {
    if (busy) return;
    setBusy(true);
    const current = generation.current;
    let replacement: MediaStream | null = null;
    try {
      if (!stream.current) {
        setInputId(id);
        return;
      }
      replacement = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          ...(id ? { deviceId: { exact: id } } : {}),
        },
        video: false,
      });
      if (!active.current || current !== generation.current) {
        replacement.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = replacement.getAudioTracks()[0]!;
      track.enabled = enabled;
      const oldTrack = stream.current.getAudioTracks()[0]!;
      const senders = [...peers.current.values()].map((peer) => ({
        peer,
        sender: peer.pc.getSenders().find((sender) => sender.track?.kind === 'audio'),
      }));
      const results = await Promise.allSettled(
        senders.map(async ({ sender }) => {
          if (sender) await sender.replaceTrack(track);
        }),
      );
      if (
        results.some((result) => result.status === 'rejected') ||
        !active.current ||
        current !== generation.current
      ) {
        await Promise.allSettled(
          senders.map(async ({ sender }) => {
            if (sender) await sender.replaceTrack(oldTrack);
          }),
        );
        throw new Error('Audio device switch failed');
      }
      for (const { peer, sender } of senders) if (!sender) peer.pc.addTrack(track, replacement);
      stream.current.getTracks().forEach((track) => track.stop());
      stream.current = replacement;
      replacement = null;
      setInputId(id);
      const available = await navigator.mediaDevices.enumerateDevices();
      if (active.current && current === generation.current) setDevices(available);
    } catch {
      replacement?.getTracks().forEach((track) => track.stop());
      notify('Không đổi được micro. Kiểm tra lại thiết bị âm thanh.');
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function changeOutput(id: string) {
    try {
      if (typeof HTMLMediaElement.prototype.setSinkId !== 'function') {
        notify('Trình duyệt này chưa cho chọn loa. Dùng thiết bị mặc định của hệ thống.');
        return;
      }
      await Promise.all([...peers.current.values()].map((peer) => peer.audio.setSinkId(id)));
      output.current = id;
      setOutputId(id);
    } catch {
      notify('Không đổi được loa. Kiểm tra quyền chọn thiết bị của trình duyệt.');
    }
  }
  function toggleDeafen() {
    deaf.current = !deaf.current;
    setDeafened(deaf.current);
    for (const peer of peers.current.values()) {
      peer.audio.muted = deaf.current;
      if (!deaf.current)
        void peer.audio
          .play()
          .catch(() => notify('Chưa bật được âm thanh. Kiểm tra quyền phát âm thanh.'));
    }
  }
  return {
    enabled,
    deafened,
    busy,
    toggleMic,
    toggleDeafen,
    devices,
    inputId,
    outputId,
    changeInput,
    changeOutput,
    connections,
  };
}
