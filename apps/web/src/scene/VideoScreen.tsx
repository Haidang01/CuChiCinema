import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { SRGBColorSpace, VideoTexture } from 'three';

export default function VideoScreen({ video }: { video: HTMLVideoElement | null }) {
  const [texture, setTexture] = useState<VideoTexture | null>(null);
  const [aspect, setAspect] = useState(16 / 9);
  const invalidate = useThree((state) => state.invalidate);
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
  const width = aspect >= 16 / 9 ? 9 : 5.0625 * aspect;
  const height = aspect >= 16 / 9 ? 9 / aspect : 5.0625;
  return (
    <group position={[0, 2.6, -5]}>
      <mesh>
        <boxGeometry args={[9.4, 5.4, 0.15]} />
        <meshBasicMaterial color="#080b14" />
      </mesh>
      <mesh position={[0, 0, 0.09]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          key={texture?.uuid ?? 'placeholder'}
          map={texture}
          color={texture ? '#ffffff' : '#65738f'}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
