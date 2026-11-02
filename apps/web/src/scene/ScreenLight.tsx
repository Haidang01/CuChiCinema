import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  SRGBColorSpace,
  type RectAreaLight,
  type HemisphereLight,
  type ShaderMaterial,
} from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { ScreenDimensions } from './screen-projection';
import { sampleScreenZones, type ScreenSample } from './screen-light';

RectAreaLightUniformsLib.init();
const vertexShader = `varying vec2 uvScreen;
  void main(){ uvScreen=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const fragmentShader = `varying vec2 uvScreen; uniform vec3 tint; uniform float strength;
  void main(){ vec2 d=abs(uvScreen-0.5)*2.0;
    float halo=pow(max(0.0,1.0-max(d.x,d.y)),1.5);
    gl_FragColor=vec4(tint,halo*strength); }`;

export default function ScreenLight({
  screen,
  video,
  imageUrl,
  embedded,
  active,
}: {
  screen: ScreenDimensions;
  video: HTMLVideoElement | null;
  imageUrl?: string;
  embedded: boolean;
  active: boolean;
}) {
  const lights = useRef<(RectAreaLight | null)[]>([]);
  const halo = useRef<ShaderMaterial>(null);
  const bounce = useRef<HemisphereLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  const target = useMemo(
    () => [0, 1].map(() => ({ color: new Color('#b9cfff'), intensity: 0.5 })),
    [],
  );
  const uniforms = useMemo(
    () => ({ tint: { value: new Color('#b9cfff') }, strength: { value: 0.1 } }),
    [],
  );
  useEffect(() => {
    let disposed = false,
      readable = true;
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 4;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const update = (samples: ScreenSample[]) => {
      samples.forEach((sample, index) => {
        const value = target[index]!;
        value.color.setRGB(sample.r, sample.g, sample.b, SRGBColorSpace);
        // Black frames really dim the room. Keep only the separate aisle lights on.
        value.intensity = Math.min(7.5, 0.12 + sample.luminance * 6.2);
      });
      invalidate();
    };
    // YouTube's cross-origin iframe is opaque: use steady screen-white illumination.
    target.forEach((value) => {
      value.color.set(active ? '#b9cfff' : '#dbb58c');
      value.intensity = active ? 2.8 : 0.45;
    });
    const sample = (source?: CanvasImageSource) => {
      if (disposed || !readable || !ctx || document.hidden || embedded) return;
      const media = source ?? (video && video.readyState >= 2 ? video : null);
      if (!media) return;
      try {
        ctx.drawImage(media, 0, 0, 8, 4);
        const zones = sampleScreenZones(ctx.getImageData(0, 0, 8, 4).data, 8, 4);
        if (zones) update(zones);
      } catch {
        // A tainted external video retains neutral fill; don't retry pixel reads.
        readable = false;
      }
    };
    const changed = () => sample();
    const events = ['loadeddata', 'seeked', 'pause', 'play'];
    events.forEach((event) => video?.addEventListener(event, changed));
    let image: HTMLImageElement | undefined;
    if (imageUrl) {
      image = new Image();
      image.onload = () => sample(image);
      image.src = imageUrl;
    }
    sample();
    const timer =
      video && !embedded
        ? window.setInterval(() => {
            if (!video.paused) sample();
          }, 200)
        : undefined;
    invalidate();
    return () => {
      disposed = true;
      if (timer !== undefined) clearInterval(timer);
      events.forEach((event) => video?.removeEventListener(event, changed));
      if (image) {
        image.onload = null;
        image.src = '';
      }
    };
  }, [video, imageUrl, embedded, active, target, invalidate]);
  useFrame((_, delta) => {
    const alpha = 1 - Math.exp(-5 * Math.min(delta, 0.1));
    let unsettled = false;
    lights.current.forEach((light, index) => {
      if (!light) return;
      const value = target[index]!;
      light.color.lerp(value.color, alpha);
      light.intensity += (value.intensity - light.intensity) * alpha;
      unsettled ||=
        Math.abs(light.intensity - value.intensity) > 0.01 ||
        Math.abs(light.color.r - value.color.r) +
          Math.abs(light.color.g - value.color.g) +
          Math.abs(light.color.b - value.color.b) >
          0.005;
    });
    if (halo.current && lights.current[0] && lights.current[1]) {
      uniforms.tint.value.copy(lights.current[0].color).lerp(lights.current[1].color, 0.5);
      if (bounce.current) {
        bounce.current.color.copy(uniforms.tint.value);
        bounce.current.groundColor.copy(uniforms.tint.value).multiplyScalar(0.35);
        bounce.current.intensity =
          0.035 + (lights.current[0].intensity + lights.current[1].intensity) * 0.045;
      }
      uniforms.strength.value = Math.min(
        0.42,
        (lights.current[0].intensity + lights.current[1].intensity) * 0.035,
      );
    }
    if (unsettled) invalidate();
  });
  return (
    <group>
      <hemisphereLight ref={bounce} args={['#b9cfff', '#20232d', 0.2]} />
      {[-1, 1].map((side, index) => (
        <rectAreaLight
          key={side}
          ref={(node) => {
            lights.current[index] = node;
          }}
          position={[(side * screen.width) / 4, screen.y, screen.z + 0.18]}
          rotation={[0, Math.PI, 0]}
          width={screen.width / 2}
          height={screen.height}
          intensity={0.5}
          color="#b9cfff"
        />
      ))}
      <mesh position={[0, screen.y, screen.z - 0.27]}>
        <planeGeometry args={[screen.width + 2.2, screen.height + 2.2]} />
        <shaderMaterial
          ref={halo}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
