import { dancePose } from './dance-pose';
import type { Appearance, AvatarActionEvent } from '@cineverse/shared';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  SplineCurve,
  Vector2,
  type Group,
} from 'three';

export const palette = {
  skin: { porcelain: '#f2cfb9', sand: '#dca77d', amber: '#b77d52', cocoa: '#764c39' },
  hairColor: { espresso: '#282130', chestnut: '#774a35', silver: '#bac0d3' },
  outfit: { midnight: '#6378a5', rose: '#bc7785', sage: '#739f91', cream: '#e7d8b9' },
};
type Point = [number, number, number];
function Ball({
  at,
  scale,
  color,
  roughness = 0.72,
}: {
  at: Point;
  scale: Point;
  color: string;
  roughness?: number;
}) {
  return (
    <mesh position={at} scale={scale} castShadow>
      <sphereGeometry args={[1, 24, 18]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

const torsoProfile = new SplineCurve(
  [
    [0, 1.05],
    [0.23, 1.05],
    [0.29, 1.13],
    [0.265, 1.38],
    [0.3, 1.65],
    [0.365, 1.86],
    [0.34, 1.94],
    [0.16, 2.015],
    [0, 2.015],
  ].map(([x, y]) => new Vector2(x!, y!)),
).getPoints(48);
function Limb({
  length,
  top,
  bottom,
  color,
  fabric,
}: {
  length: number;
  top: number;
  bottom: number;
  color: string;
  fabric?: CanvasTexture;
}) {
  return (
    <mesh position={[0, -length / 2, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[top, bottom, length, 16]} />
      <meshStandardMaterial
        color={color}
        roughness={fabric ? 0.96 : 0.72}
        map={fabric}
        bumpMap={fabric}
        bumpScale={0.004}
      />
    </mesh>
  );
}

export default function Avatar({
  appearance,
  seated = false,
  walking = false,
  action,
  clockOffset = 0,
}: {
  appearance: Appearance;
  seated?: boolean;
  walking?: boolean;
  action?: AvatarActionEvent;
  clockOffset?: number;
}) {
  const body = useRef<Group>(null);
  const head = useRef<Group>(null);
  const arms = useRef<(Group | null)[]>([]);
  const forearms = useRef<(Group | null)[]>([]);
  const legs = useRef<(Group | null)[]>([]);
  const knees = useRef<(Group | null)[]>([]);
  const fabric = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const shade = 205 + ((x * 17 + y * 31) % 36);
        ctx.fillStyle = 'rgb(' + shade + ',' + shade + ',' + shade + ')';
        ctx.fillRect(x, y, 1, 1);
      }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(5, 5);
    return texture;
  }, []);
  useEffect(() => () => fabric.dispose(), [fabric]);
  const invalidate = useThree((state) => state.invalidate);
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => {
      reduced.current = media.matches;
      invalidate();
    };
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [invalidate]);
  useEffect(() => {
    invalidate();
  }, [action, walking, seated, invalidate]);
  useFrame(({ clock }) => {
    if (!body.current) return;
    const elapsed = action ? (Date.now() + clockOffset - action.at) / 1000 : 0;
    const duration = (action?.duration ?? 0) / 1000;
    const fullBody =
      !!action &&
      (action.action === 'dance' ||
        action.action.startsWith('dance_') ||
        action.action.startsWith('duet_') ||
        action.action === 'jump');
    const active =
      !!action &&
      elapsed >= 0 &&
      elapsed < duration &&
      !reduced.current &&
      !(fullBody && (walking || seated));
    const t = elapsed;
    const envelope = active
      ? Math.sin((Math.min(1, t / 0.18) * Math.PI) / 2) *
        Math.sin((Math.min(1, (duration - t) / 0.25) * Math.PI) / 2)
      : 0;
    body.current.position.y = seated ? -0.61 : 0;
    body.current.position.x = 0;
    body.current.position.z = 0;
    body.current.rotation.set(0, 0, 0);
    head.current?.rotation.set(0, 0, 0);
    arms.current.forEach((arm, index) => {
      if (arm) {
        arm.rotation.set(
          walking ? Math.sin(clock.elapsedTime * 9 + index * Math.PI) * 0.22 : 0,
          0,
          0,
        );
      }
    });
    forearms.current.forEach((arm) => arm?.rotation.set(0, 0, 0));
    legs.current.forEach((leg, index) => {
      if (leg)
        leg.rotation.set(
          seated
            ? -Math.PI / 2
            : walking
              ? Math.sin(clock.elapsedTime * 9 + index * Math.PI) * 0.5
              : 0,
          0,
          0,
        );
    });
    knees.current.forEach((knee, index) => {
      if (knee)
        knee.rotation.x = seated
          ? Math.PI / 2
          : walking
            ? Math.max(0, Math.sin(clock.elapsedTime * 9 + index * Math.PI)) * 0.65
            : 0.04;
    });
    if (seated && !active && !reduced.current) {
      const phase = clock.elapsedTime;
      body.current.rotation.z = Math.sin(phase * 0.72) * 0.018;
      body.current.rotation.y = Math.sin(phase * 0.43) * 0.025;
      body.current.position.y -= Math.max(0, Math.sin(phase * 0.55)) * 0.012;
      if (head.current) {
        head.current.rotation.x = Math.sin(phase * 0.8) * 0.025;
        head.current.rotation.y = Math.sin(phase * 0.31) * 0.045;
      }
      invalidate();
    }
    if (active) {
      if (action.action === 'wave') {
        const arm = arms.current[1],
          forearm = forearms.current[1];
        if (arm) arm.rotation.z = 2.5 * envelope;
        if (forearm) forearm.rotation.z = (-0.35 + Math.sin(t * 13) * 0.32) * envelope;
      }
      if (action.action === 'nod' && head.current)
        head.current.rotation.x = Math.sin(t * 9) * 0.27 * envelope;
      if (action.action === 'talk') {
        if (head.current) head.current.rotation.y = Math.sin(t * 7) * 0.12 * envelope;
        arms.current.forEach((arm, index) => {
          if (arm)
            arm.rotation.z = (index ? -1 : 1) * (0.18 + Math.sin(t * 9 + index) * 0.14) * envelope;
        });
      }
      if (action.action === 'eat_popcorn' || action.action === 'drink') {
        const arm = arms.current[1];
        if (arm) arm.rotation.x = -1.05 * envelope;
        if (head.current) head.current.rotation.x = -0.12 * envelope;
      }
      if (action.action === 'throw_popcorn') {
        const arm = arms.current[1],
          forearm = forearms.current[1];
        if (arm) arm.rotation.x = -1.25 * envelope + Math.sin(t * 12) * 0.16 * envelope;
        if (forearm) forearm.rotation.x = 1.2 * envelope;
      }
      if (action.action === 'lean') body.current.rotation.x = -0.1 * envelope;
      if (action.action === 'whisper') {
        if (head.current) head.current.rotation.z = Math.sin(t * 8) * 0.16 * envelope;
        arms.current[1] && (arms.current[1]!.rotation.x = -0.5 * envelope);
      }
      if (action.action === 'sleep' && head.current)
        head.current.rotation.z = Math.sin(t * 3) * 0.13 * envelope;
      if (action.action === 'laugh') {
        body.current.rotation.z = Math.sin(t * 13) * 0.06 * envelope;
        if (head.current) head.current.rotation.x = Math.sin(t * 11) * 0.09 * envelope;
      }
      if (action.action === 'stretch')
        arms.current.forEach((arm, index) => {
          if (arm) arm.rotation.z = (index ? 1 : -1) * (1.5 + Math.sin(t * 3) * 0.12) * envelope;
        });
      if (action.action === 'clap')
        arms.current.forEach((arm, index) => {
          const side = index === 0 ? -1 : 1;
          if (arm) {
            arm.rotation.x = -1.12 * envelope;
            arm.rotation.z = -side * (0.4 + Math.sin(t * 12) * 0.16) * envelope;
          }
          const forearm = forearms.current[index];
          if (forearm) forearm.rotation.z = -side * 0.9 * envelope;
        });
      if (action.action === 'cheer') {
        arms.current.forEach((arm, index) => {
          if (arm)
            arm.rotation.z = (index === 0 ? -1 : 1) * (2.5 + Math.sin(t * 10) * 0.15) * envelope;
        });
        if (!seated) body.current.position.y += Math.abs(Math.sin(t * 7)) * 0.065 * envelope;
      }
      if (action.action === 'dance') {
        body.current.rotation.z = Math.sin(t * 7) * 0.12 * envelope;
        body.current.rotation.y = Math.sin(t * 3.5) * 0.18 * envelope;
        body.current.position.y += Math.abs(Math.sin(t * 7)) * 0.09 * envelope;
        arms.current.forEach((arm, index) => {
          if (arm) {
            arm.rotation.x = (-0.7 + Math.sin(t * 7 + index * Math.PI) * 0.6) * envelope;
            arm.rotation.z = (index === 0 ? -1 : 1) * 0.5 * envelope;
          }
        });
        legs.current.forEach((leg, index) => {
          if (leg) leg.rotation.x = Math.sin(t * 7 + index * Math.PI) * 0.25 * envelope;
        });
      }
      if (action.action.startsWith('dance_') || action.action.startsWith('duet_')) {
        const pose = dancePose(action.action, t, action.role);
        body.current.position.x = pose.x * envelope;
        body.current.position.y += pose.y * envelope;
        body.current.position.z = pose.z * envelope;
        body.current.rotation.set(pose.rx * envelope, pose.ry * envelope, pose.rz * envelope);
        arms.current.forEach((arm, index) => {
          if (arm)
            arm.rotation.set(pose.armsX[index]! * envelope, 0, pose.armsZ[index]! * envelope);
        });
        forearms.current.forEach((arm, index) => {
          if (arm) arm.rotation.x = pose.elbows[index]! * envelope;
        });
        legs.current.forEach((leg, index) => {
          if (leg) leg.rotation.x = pose.legs[index]! * envelope;
        });
        knees.current.forEach((knee, index) => {
          if (knee) knee.rotation.x = pose.knees[index]! * envelope;
        });
      }
      if (action.action === 'jump') {
        const jump = Math.max(0, Math.sin(t * Math.PI * 2));
        body.current.position.y += jump * 0.55 * envelope;
        arms.current.forEach((arm, index) => {
          if (arm) arm.rotation.z = (index === 0 ? -1 : 1) * jump * 2 * envelope;
        });
      }
    }
    if (walking || (active && envelope >= 0)) invalidate();
  });
  const skin = palette.skin[appearance.skin];
  const hair = palette.hairColor[appearance.hairColor];
  const shirt = palette.outfit[appearance.outfit];
  return (
    <group ref={body} position={[0, seated ? -0.61 : 0, 0]}>
      <group ref={head} position={[0, 2.08, 0]}>
        <Ball at={[0, 0.255, -0.015]} scale={[0.255, 0.345, 0.24]} color={skin} />
        <Ball at={[0, 0.075, 0.015]} scale={[0.18, 0.15, 0.17]} color={skin} />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Ball at={[side * 0.252, 0.24, -0.015]} scale={[0.04, 0.081, 0.045]} color={skin} />
            <Ball at={[side * 0.102, 0.29, 0.206]} scale={[0.057, 0.027, 0.022]} color="#d7d2c8" />
            <Ball at={[side * 0.102, 0.29, 0.225]} scale={[0.022, 0.023, 0.008]} color={hair} />
            <Ball at={[side * 0.102, 0.29, 0.232]} scale={[0.01, 0.015, 0.004]} color="#171916" />
            <mesh position={[side * 0.104, 0.342, 0.213]} rotation={[0, 0, side * -0.08]}>
              <boxGeometry args={[0.106, 0.017, 0.017]} />
              <meshStandardMaterial color={hair} roughness={0.95} />
            </mesh>
          </group>
        ))}
        <Ball at={[0, 0.222, 0.222]} scale={[0.035, 0.082, 0.043]} color={skin} />
        <Ball at={[0, 0.175, 0.25]} scale={[0.043, 0.031, 0.043]} color={skin} />
        <Ball at={[0, 0.105, 0.224]} scale={[0.067, 0.014, 0.013]} color="#995f56" />
        <Ball at={[0, 0.087, 0.221]} scale={[0.058, 0.013, 0.012]} color="#b27a6d" />
        <mesh position={[0, 0.29, -0.023]} scale={[1, 1.15, 1]} castShadow>
          <sphereGeometry args={[0.28, 24, 16, 0, Math.PI * 2, 0, 1.48]} />
          <meshStandardMaterial color={hair} roughness={0.95} />
        </mesh>
        <Ball at={[0, 0.45, -0.095]} scale={[0.23, 0.12, 0.21]} color={hair} roughness={0.95} />
        {appearance.hair !== 'crop' ? (
          <>
            <Ball
              at={[-0.225, 0.18, -0.095]}
              scale={[0.073, 0.29, 0.18]}
              color={hair}
              roughness={0.95}
            />
            <Ball
              at={[0.225, 0.18, -0.095]}
              scale={[0.073, 0.29, 0.18]}
              color={hair}
              roughness={0.95}
            />
            <Ball
              at={[0, 0.19, -0.19]}
              scale={[0.235, 0.29, 0.095]}
              color={hair}
              roughness={0.95}
            />
          </>
        ) : null}
        {appearance.hair === 'bun' ? (
          <Ball at={[0, 0.52, -0.19]} scale={[0.14, 0.14, 0.13]} color={hair} roughness={0.95} />
        ) : null}
        {appearance.accessory === 'glasses' ? (
          <group position={[0, 0.29, 0.245]}>
            {[-0.105, 0.105].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <torusGeometry args={[0.075, 0.009, 6, 24]} />
                <meshStandardMaterial color="#a9936d" metalness={0.5} roughness={0.45} />
              </mesh>
            ))}
            <mesh>
              <boxGeometry args={[0.065, 0.009, 0.009]} />
              <meshStandardMaterial color="#a9936d" />
            </mesh>
          </group>
        ) : null}
      </group>
      <mesh position={[0, 2.045, 0]} castShadow>
        <cylinderGeometry args={[0.105, 0.12, 0.22, 16]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh scale={[1, 1, 0.65]} castShadow receiveShadow>
        <latheGeometry args={[torsoProfile, 24]} />
        <meshStandardMaterial color={shirt} roughness={0.96} bumpMap={fabric} bumpScale={0.006} />
      </mesh>
      <mesh position={[0, 2.004, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.72, 1]}>
        <torusGeometry args={[0.133, 0.024, 8, 24]} />
        <meshStandardMaterial color={shirt} roughness={1} />
      </mesh>
      <Ball at={[0, 1.1, 0]} scale={[0.29, 0.17, 0.19]} color="#333942" roughness={0.98} />
      {[-1, 1].map((side, index) => (
        <group key={side}>
          <group
            ref={(node) => {
              arms.current[index] = node;
            }}
            position={[side * 0.355, 1.88, 0]}
          >
            <Ball
              at={[side * 0.015, -0.065, 0]}
              scale={[0.12, 0.11, 0.13]}
              color={shirt}
              roughness={0.96}
            />
            <Limb length={0.28} top={0.12} bottom={0.095} color={shirt} fabric={fabric} />
            <Limb length={0.37} top={0.086} bottom={0.075} color={skin} />
            <group
              ref={(node) => {
                forearms.current[index] = node;
              }}
              position={[0, -0.37, 0]}
            >
              <Ball at={[0, 0, 0]} scale={[0.076, 0.074, 0.075]} color={skin} />
              <Limb length={0.34} top={0.078} bottom={0.049} color={skin} />
              <Ball at={[0, -0.405, 0.012]} scale={[0.059, 0.095, 0.035]} color={skin} />
              <Ball at={[-side * 0.05, -0.386, 0.03]} scale={[0.022, 0.055, 0.025]} color={skin} />
            </group>
          </group>
          <group
            ref={(node) => {
              legs.current[index] = node;
            }}
            position={[side * 0.151, 1.1, 0]}
            rotation={[seated ? -Math.PI / 2 : 0, 0, 0]}
          >
            <Limb length={0.51} top={0.145} bottom={0.104} color="#333942" fabric={fabric} />
            <group
              ref={(node) => {
                knees.current[index] = node;
              }}
              position={[0, -0.51, 0]}
              rotation={[seated ? Math.PI / 2 : 0.04, 0, 0]}
            >
              <Ball at={[0, 0, 0]} scale={[0.105, 0.1, 0.105]} color="#333942" roughness={0.98} />
              <Limb length={0.47} top={0.102} bottom={0.067} color="#333942" fabric={fabric} />
              <Ball
                at={[0, -0.496, 0.075]}
                scale={[0.09, 0.085, 0.18]}
                color="#393c3c"
                roughness={0.93}
              />
              <Ball
                at={[0, -0.544, 0.075]}
                scale={[0.094, 0.027, 0.18]}
                color="#bcb6a6"
                roughness={1}
              />
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}
