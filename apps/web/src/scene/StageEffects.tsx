import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Object3D,
  Vector3,
  type Mesh,
  type MeshBasicMaterial,
  type PointLight,
  type SpotLight,
} from 'three';
import type { StageSettings } from '@cineverse/shared';

export default function StageEffects({
  settings,
  clockOffset,
}: {
  settings: StageSettings;
  clockOffset: number;
}) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => invalidate(), [settings, reduced, invalidate]);
  const lights = useRef<(SpotLight | null)[]>([]),
    washes = useRef<(PointLight | null)[]>([]),
    beams = useRef<(Mesh | null)[]>([]),
    materials = useRef<(MeshBasicMaterial | null)[]>([]);
  const targets = useMemo(() => Array.from({ length: 4 }, () => new Object3D()), []);
  const scratch = useMemo(
    () => ({
      from: new Vector3(),
      to: new Vector3(),
      direction: new Vector3(),
      up: new Vector3(0, 1, 0),
    }),
    [],
  );
  const particles = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(160 * 3),
      colors = new Float32Array(160 * 3);
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return {
      geometry,
      positions,
      colors,
      palette: [new Color('#f4bc7c'), new Color('#99cfff'), new Color('#eea3d0')],
    };
  }, []);
  useEffect(() => () => particles.geometry.dispose(), [particles]);
  const moving = settings.enabled && settings.beams && settings.lighting !== 'cinema' && !reduced;
  const fireworks = settings.enabled && settings.fireworks && !reduced;
  useFrame(() => {
    if (!settings.enabled) return;
    const time = Math.max(0, Date.now() + clockOffset - settings.updatedAt) / 1000;
    const phase = moving ? time : 0;
    lights.current.forEach((light, index) => {
      if (!light) return;
      const x = -2.25 + index * 1.5;
      targets[index]!.position.set(
        x + Math.sin(phase * 0.65 + index) * 0.65,
        0,
        -2.25 + Math.cos(phase * 0.55 + index) * 0.6,
      );
      light.intensity =
        settings.intensity *
        (settings.lighting === 'concert' ? 38 : settings.lighting === 'bar' ? 24 : 12);
      if (settings.lighting === 'cinema') light.color.set('#ffe0b0');
      else if (settings.lighting === 'bar') light.color.set(index % 2 ? '#48bbef' : '#c479e9');
      else light.color.setHSL((phase * 0.045 + index * 0.22) % 1, 0.65, 0.65);
      const beam = beams.current[index],
        material = materials.current[index];
      if (beam) {
        scratch.from.set(x, 4.5, -1.1);
        scratch.to.copy(targets[index]!.position);
        scratch.direction.subVectors(scratch.to, scratch.from);
        beam.position.copy(scratch.from).add(scratch.to).multiplyScalar(0.5);
        beam.scale.set(1, scratch.direction.length(), 1);
        beam.quaternion.setFromUnitVectors(scratch.up, scratch.direction.normalize());
      }
      if (material) {
        material.color.copy(light.color);
        material.opacity = settings.intensity * 0.055;
      }
    });
    washes.current.forEach((light, index) => {
      if (light) {
        light.intensity = settings.intensity * (settings.lighting === 'cinema' ? 2 : 12);
        light.color.set(settings.lighting === 'cinema' ? '#d7b385' : index ? '#448dcc' : '#9f44b4');
      }
    });
    if (fireworks) {
      for (let index = 0; index < 160; index++) {
        const side = index < 80 ? -1 : 1;
        const age = (time + (side === 1 ? 2.5 : 0)) % 5;
        const burst = age - 0.8;
        const seed = index * 2.3999632297;
        const vertical = (((index * 37) % 79) / 79) * 1.6 - 0.3;
        const speed = 0.65 + (((index * 17) % 43) / 43) * 0.65;
        const fade =
          burst >= 0 && burst < 2.1
            ? Math.sin((Math.min(1, burst / 0.16) * Math.PI) / 2) * Math.max(0, 1 - burst / 2.1)
            : 0;
        const offset = index * 3;
        particles.positions[offset] =
          side * 2.65 + (burst > 0 ? Math.cos(seed) * speed * burst : 0);
        particles.positions[offset + 1] =
          age < 0.8
            ? 0.1 + age * 3
            : 2.5 + vertical * Math.max(0, burst) - 1.3 * Math.max(0, burst) ** 2;
        particles.positions[offset + 2] =
          -2.4 + (burst > 0 ? Math.sin(seed) * speed * burst * 0.4 : 0);
        const color = particles.palette[index % 3]!;
        const brightness = age < 0.8 ? 0.35 : fade;
        particles.colors[offset] = color.r * brightness;
        particles.colors[offset + 1] = color.g * brightness;
        particles.colors[offset + 2] = color.b * brightness;
      }
      particles.geometry.attributes.position!.needsUpdate = true;
      particles.geometry.attributes.color!.needsUpdate = true;
    }
    if (moving || fireworks) invalidate();
  });
  if (!settings.enabled) return null;
  return (
    <group>
      <mesh position={[0, -0.022, -2.25]} receiveShadow>
        <boxGeometry args={[6.2, 0.024, 2.5]} />
        <meshStandardMaterial color="#22212c" roughness={0.88} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 3.08, 0.006, -2.25]}>
            <boxGeometry args={[0.025, 0.014, 2.5]} />
            <meshBasicMaterial color={settings.lighting === 'bar' ? '#9d82d5' : '#d8b486'} />
          </mesh>
          <mesh position={[0, 0.006, -2.25 + side * 1.23]}>
            <boxGeometry args={[6.2, 0.014, 0.025]} />
            <meshBasicMaterial color="#b99c78" />
          </mesh>
          <pointLight
            ref={(node) => {
              washes.current[side === -1 ? 0 : 1] = node;
            }}
            position={[side * 2.8, 0.4, -2.5]}
            intensity={6}
            distance={6}
            decay={2}
          />
        </group>
      ))}
      {targets.map((target, index) => (
        <group key={index}>
          <primitive object={target} />
          <spotLight
            ref={(node) => {
              lights.current[index] = node;
            }}
            position={[-2.25 + index * 1.5, 4.5, -1.1]}
            target={target}
            angle={0.38}
            penumbra={1}
            distance={10}
            decay={2}
            intensity={16}
          />
          <mesh position={[-2.25 + index * 1.5, 4.5, -1.1]}>
            <cylinderGeometry args={[0.09, 0.11, 0.16, 12]} />
            <meshStandardMaterial color="#252b35" roughness={0.7} />
          </mesh>
          <mesh
            ref={(node) => {
              beams.current[index] = node;
            }}
            visible={settings.beams && settings.lighting !== 'cinema' && !reduced}
          >
            <cylinderGeometry args={[0.04, 0.6, 1, 16, 1, true]} />
            <meshBasicMaterial
              ref={(node) => {
                materials.current[index] = node;
              }}
              transparent
              depthWrite={false}
              blending={AdditiveBlending}
              opacity={0.04}
            />
          </mesh>
        </group>
      ))}
      {fireworks ? (
        <points geometry={particles.geometry} frustumCulled={false}>
          <pointsMaterial
            size={0.045}
            vertexColors
            transparent
            opacity={0.85}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      ) : null}
    </group>
  );
}
