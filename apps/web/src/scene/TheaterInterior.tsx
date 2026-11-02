import { useEffect, useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { type RoomSnapshot } from '@cineverse/shared';
import { theaterDimensions } from './screen-projection';
import RoomShellPart from './RoomShellPart';
export default function TheaterInterior({
  snapshot,
  lighting,
  onFloor,
}: {
  snapshot: RoomSnapshot;
  lighting: boolean;
  onFloor: (x: number, z: number) => void;
}) {
  const { halfWidth, top, rear, screen } = theaterDimensions(snapshot.seats);
  const rows = [...new Map(snapshot.seats.map((s) => [s.z, s])).values()];
  const frontWall = screen.z - 0.65;
  const length = rear - frontWall;
  const center = (rear + frontWall) / 2;
  const carpet = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = snapshot.room.wallColor ?? '#29252c';
    ctx.fillRect(0, 0, 128, 128);
    let seed = 17;
    for (let i = 0; i < 6500; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = seed % 128;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      ctx.fillStyle = i % 3 ? '#363039' : '#19191f';
      ctx.fillRect(x, seed % 128, 1, 1);
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(9, length);
    return texture;
  }, [length, snapshot.room.wallColor]);
  useEffect(() => () => carpet.dispose(), [carpet]);
  return (
    <group>
      {rows
        .filter((s) => s.y > 0)
        .map((s) => (
          <group key={s.z}>
            <mesh
              position={[
                0,
                s.y / 2 - 0.02,
                s.z === rows.at(-1)?.z
                  ? (s.z - (snapshot.room.rowSpacing ?? 2.2) / 2 + rear) / 2
                  : s.z,
              ]}
              receiveShadow
              onClick={(e) => {
                e.stopPropagation();
                if (e.delta < 7) onFloor(e.point.x, e.point.z);
              }}
            >
              <boxGeometry
                args={[
                  halfWidth * 2,
                  s.y,
                  s.z === rows.at(-1)?.z
                    ? (snapshot.room.rowSpacing ?? 2.2) / 2 + rear - s.z
                    : (snapshot.room.rowSpacing ?? 2.2),
                ]}
              />
              <meshStandardMaterial map={carpet} bumpMap={carpet} bumpScale={0.018} roughness={1} />
            </mesh>
            {[-halfWidth + 0.52, -0.65, 0.65, halfWidth - 0.52].map((x) => (
              <mesh key={x} position={[x, s.y + 0.012, s.z - (snapshot.room.rowSpacing ?? 2.2) / 2]}>
                <boxGeometry args={[0.64, 0.018, 0.035]} />
                <meshBasicMaterial color={lighting ? '#d8b37b' : '#614935'} toneMapped={false} />
              </mesh>
            ))}
          </group>
        ))}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.035, center]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          if (event.delta < 7) onFloor(event.point.x, event.point.z);
        }}
      >
        <planeGeometry args={[halfWidth * 2, length]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      {[-halfWidth + 0.3, halfWidth - 0.3, -0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, -0.018, center]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.022, length - 0.3]} />
          <meshBasicMaterial color="#bd9156" />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <RoomShellPart key={side} axis="x" boundary={side * halfWidth} insideLess={side > 0}>
          <mesh position={[side * halfWidth, top / 2, center]}>
            <boxGeometry args={[0.18, top, length]} />
            <meshStandardMaterial color="#171c23" roughness={0.95} />
          </mesh>
          <mesh position={[side * (halfWidth - 0.12), 0.45, center]}>
            <boxGeometry args={[0.04, 0.9, length]} />
            <meshStandardMaterial color="#382e2c" roughness={0.6} />
          </mesh>
          <mesh position={[side * (halfWidth - 0.16), 0.94, center]}>
            <boxGeometry args={[0.025, 0.035, length]} />
            <meshStandardMaterial color="#96744b" metalness={0.35} roughness={0.62} />
          </mesh>
            {Array.from({ length: Math.ceil(length / 1.7) }, (_, i) => (
            <group key={i} position={[side * (halfWidth - 0.16), 0, screen.z + 0.3 + i * 1.7]}>
              <mesh position={[0, 3.15, 0]}>
                <boxGeometry args={[0.08, 3.7, 1.35]} />
                <meshStandardMaterial color={i % 2 ? '#252b33' : '#2d333c'} roughness={1} />
              </mesh>
              <mesh position={[-side * 0.055, 3.15, 0.71]}>
                <boxGeometry args={[0.03, 4.1, 0.035]} />
                <meshStandardMaterial color="#79593d" metalness={0.4} roughness={0.6} />
              </mesh>
              <mesh position={[-side * 0.09, 2.2, 0]}>
                <boxGeometry args={[0.11, 0.55, 0.18]} />
                <meshStandardMaterial color="#caa36a" metalness={0.5} roughness={0.3} />
              </mesh>
                  <mesh position={[-side * 0.16, 2.2, 0]}>
                <boxGeometry args={[0.025, 0.36, 0.12]} />
                    <meshStandardMaterial
                      color="#4c3224"
                      emissive={lighting ? '#d59452' : '#241812'}
                      emissiveIntensity={lighting ? 0.55 : 0.08}
                      roughness={0.8}
                    />
              </mesh>
              <mesh position={[-side * 0.04, 0.17, 0]}>
                <boxGeometry args={[0.025, 0.045, 0.38]} />
                <meshBasicMaterial color="#eac28b" />
              </mesh>
            </group>
          ))}
          <mesh position={[side * (halfWidth - 0.23), 5.45, center]}>
            <boxGeometry args={[0.1, 0.045, length]} />
            <meshStandardMaterial
              color="#49352b"
              emissive={lighting ? '#d89b63' : '#241a17'}
              emissiveIntensity={lighting ? 0.5 : 0.06}
              roughness={0.9}
            />
          </mesh>
        </RoomShellPart>
      ))}
      <RoomShellPart axis="z" boundary={frontWall + 0.25} insideLess={false}>
        <mesh position={[0, top / 2, frontWall]}>
          <boxGeometry args={[halfWidth * 2, top, 0.16]} />
          <meshStandardMaterial color="#100e17" roughness={1} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            {Array.from({ length: 9 }, (_, i) => (
              <mesh
                key={i}
                position={[side * (halfWidth - 0.12 + i * 0.045), screen.y, screen.z - 0.27]}
                scale={[1, 1, 0.6]}
              >
                <cylinderGeometry args={[0.055, 0.065, screen.height + 0.22, 10]} />
                <meshStandardMaterial color={i % 2 ? '#561828' : '#742437'} roughness={1} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 0.07, screen.z + 0.3]}>
          <boxGeometry args={[halfWidth * 2 - 0.2, 0.16, 1.2]} />
          <meshStandardMaterial color="#16141b" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.16, screen.z + 0.88]}>
          <boxGeometry args={[halfWidth * 2 - 0.35, 0.025, 0.028]} />
          <meshBasicMaterial color="#d3a46d" />
        </mesh>
      </RoomShellPart>
      <RoomShellPart axis="y" boundary={top} insideLess={true}>
        <mesh position={[0, top, center]}>
          <boxGeometry args={[halfWidth * 2, 0.12, length]} />
          <meshStandardMaterial color="#11131b" roughness={1} />
        </mesh>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i} position={[0, top - 0.15, -3 + (i * (length - 2)) / 5]}>
            <boxGeometry args={[halfWidth * 2 - 0.3, 0.18, 0.12]} />
            <meshStandardMaterial color="#292630" roughness={0.9} />
          </mesh>
        ))}
      </RoomShellPart>
      <RoomShellPart axis="z" boundary={rear} insideLess={true}>
        <mesh position={[0, top / 2, rear]}>
          <boxGeometry args={[halfWidth * 2, top, 0.15]} />
          <meshStandardMaterial color={snapshot.room.wallColor ?? '#27202a'} roughness={1} />
        </mesh>
        <mesh position={[3.9, 1.2, rear - 0.1]}>
          <boxGeometry args={[1.3, 2.4, 0.08]} />
          <meshStandardMaterial color="#443436" roughness={0.6} />
        </mesh>
        <mesh position={[3.9, 2.65, rear - 0.17]}>
          <boxGeometry args={[0.6, 0.17, 0.04]} />
          <meshBasicMaterial color="#85cfad" />
        </mesh>
      </RoomShellPart>
    </group>
  );
}
