import { useEffect, useState, useMemo, useRef } from 'react';
import { type ScreenDimensions } from './screen-projection';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, SRGBColorSpace, VideoTexture, NoBlending, type Group } from 'three';

export default function VideoScreen({
  video,
  imageUrl,
  embedded = false,
  screen,
}: {
  video: HTMLVideoElement | null;
  imageUrl?: string;
  embedded?: boolean;
  screen: ScreenDimensions;
}) {
  const root = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (root.current) root.current.visible = camera.position.z > screen.z + 0.04;
  });
  const [imageTexture, setImageTexture] = useState<CanvasTexture | null>(null);
  const idle = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#15121f';
    ctx.fillRect(0, 0, 1024, 576);
    const glow = ctx.createRadialGradient(512, 280, 20, 512, 280, 530);
    glow.addColorStop(0, '#3c293a');
    glow.addColorStop(1, '#12111b');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1024, 576);
    ctx.strokeStyle = '#b88d5c';
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 40, 940, 496);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7c797';
    ctx.font = '48px Georgia';
    ctx.fillText('CineVerse', 512, 265);
    ctx.fillStyle = '#bca9b0';
    ctx.font = '22px Arial';
    ctx.fillText('Chọn phim để bắt đầu buổi chiếu', 512, 320);
    const owned = new CanvasTexture(canvas);
    owned.colorSpace = SRGBColorSpace;
    return owned;
  }, []);
  useEffect(() => () => idle.dispose(), [idle]);
  const [texture, setTexture] = useState<VideoTexture | null>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!imageUrl) {
      setImageTexture(null);
      return;
    }
    let disposed = false;
    let owned: CanvasTexture | undefined;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
      owned = new CanvasTexture(canvas);
      owned.colorSpace = SRGBColorSpace;
      setImageTexture(owned);
      setAspect(image.naturalWidth / image.naturalHeight);
      invalidate();
    };
    image.src = imageUrl;
    return () => {
      disposed = true;
      image.onload = null;
      image.src = '';
      owned?.dispose();
    };
  }, [imageUrl, invalidate]);
  useEffect(() => {
    if (!video) {
      setTexture(null);
      return;
    }
    const owned = new VideoTexture(video);
    owned.colorSpace = SRGBColorSpace;
    setTexture(owned);
    let frame = 0;
    let raf = 0;
    let disposed = false;
    let lastUploadAt = 0;
    let lastMediaTime = -1;
    const updateSize = () => {
      if (video.videoWidth && video.videoHeight) setAspect(video.videoWidth / video.videoHeight);
      if (video.readyState >= video.HAVE_CURRENT_DATA) owned.needsUpdate = true;
      invalidate();
    };
    const notifyFrame = () => {
      if (disposed) return;
      owned.needsUpdate = true;
      invalidate();
      frame = video.requestVideoFrameCallback(notifyFrame);
    };
    const fallback = (now = 0) => {
      if (disposed) return;
      if (
        video.readyState >= video.HAVE_CURRENT_DATA &&
        video.currentTime !== lastMediaTime &&
        now - lastUploadAt >= 1000 / 30
      ) {
        owned.needsUpdate = true;
        lastUploadAt = now;
        lastMediaTime = video.currentTime;
        invalidate();
      }
      raf = !video.paused && !video.ended ? requestAnimationFrame(fallback) : 0;
    };
    const startFallback = () => {
      if (!raf) raf = requestAnimationFrame(fallback);
    };
    if (typeof video.requestVideoFrameCallback === 'function')
      frame = video.requestVideoFrameCallback(notifyFrame);
    // Some browsers stop rVFC for a clipped video used only as a texture source.
    // Sample at most 30fps while playing; paused/seeked frames are uploaded explicitly.
    video.addEventListener('play', startFallback);
    startFallback();
    updateSize();
    video.addEventListener('loadedmetadata', updateSize);
    video.addEventListener('seeked', updateSize);
    video.addEventListener('loadeddata', updateSize);
    video.addEventListener('pause', updateSize);
    video.addEventListener('ended', updateSize);
    return () => {
      disposed = true;
      if (frame) video.cancelVideoFrameCallback(frame);
      cancelAnimationFrame(raf);
      video.removeEventListener('play', startFallback);
      video.removeEventListener('loadedmetadata', updateSize);
      video.removeEventListener('seeked', updateSize);
      video.removeEventListener('loadeddata', updateSize);
      video.removeEventListener('pause', updateSize);
      video.removeEventListener('ended', updateSize);
      owned.dispose();
    };
  }, [video, invalidate]);
  const width = Math.min(screen.width, screen.height * aspect);
  const height = width / aspect;
  return (
    <group ref={root} position={[0, screen.y, screen.z - 0.1]}>
      <mesh>
        <boxGeometry args={[screen.width + 0.14, screen.height + 0.14, 0.15]} />
        <meshBasicMaterial color="#05080b" />
      </mesh>
      <mesh position={[0, 0, 0.1]} renderOrder={embedded ? -1 : 0}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          opacity={embedded ? 0 : 1}
          blending={embedded ? NoBlending : undefined}
          key={imageTexture?.uuid ?? texture?.uuid ?? 'placeholder'}
          map={embedded ? null : (imageTexture ?? texture ?? idle)}
          color={embedded ? '#000000' : '#ffffff'}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
