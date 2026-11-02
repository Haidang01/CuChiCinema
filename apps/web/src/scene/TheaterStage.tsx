import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import type { ScreenDimensions } from './screen-projection';
export default function TheaterStage({ party, halfWidth, screen }: { party: boolean; halfWidth: number; screen: ScreenDimensions }) {
  const beams = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const start = new Vector3(0, screen.y + screen.height / 2 + 0.18, screen.z + 0.9),
          end = new Vector3(-halfWidth * 0.78 + i * (halfWidth * 1.56) / 9, 0.05, screen.z + 5.2 + (i % 3) * 2.2);
        const direction = end.clone().sub(start);
        return {
          position: start.clone().add(end).multiplyScalar(0.5),
          rotation: new Quaternion().setFromUnitVectors(
            new Vector3(0, 1, 0),
            direction.clone().normalize(),
          ),
          length: direction.length(),
        };
      }),
    [halfWidth, screen.height, screen.y, screen.z],
  );
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (halfWidth - 0.3), 1.05, screen.z + 0.25]}>
          <mesh>
            <boxGeometry args={[0.3, 1.8, 0.4]} />
            <meshStandardMaterial color="#181d23" roughness={0.8} />
          </mesh>
          {[-0.4, 0.25, 0.65].map((y, i) => (
            <mesh key={y} position={[0, y, 0.21]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry
                args={[i === 2 ? 0.045 : 0.11, i === 2 ? 0.045 : 0.11, 0.025, 24]}
              />
              <meshStandardMaterial color="#090e13" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}
      {[-1, 1].map((side) => {
        const x = side * Math.min(4.3, halfWidth - 0.6);
        return <group key={side} position={[x, 0.25, screen.z + 0.7]}>
          <mesh>
            <cylinderGeometry args={[0.14, 0.22, 0.22, 16]} />
            <meshStandardMaterial color="#303a3e" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh rotation={[-0.65, 0, 0]} position={[0, 0.14, -0.04]}>
            <cylinderGeometry args={[0.11, 0.11, 0.1, 16]} />
            <meshBasicMaterial color="#b8c7ed" />
          </mesh>
        </group>
      })}
      {party ? (
        <group>
        <mesh position={[0, screen.y + screen.height / 2 + 0.52, screen.z + 0.9]}>
            <cylinderGeometry args={[0.015, 0.015, 0.45, 6]} />
            <meshStandardMaterial color="#a1a69a" metalness={0.8} />
          </mesh>
        <mesh position={[0, screen.y + screen.height / 2 + 0.18, screen.z + 0.9]}>
            <icosahedronGeometry args={[0.3, 2]} />
            <meshStandardMaterial color="#aec5aa" metalness={0.7} roughness={0.24} flatShading />
          </mesh>
          {beams.map((beam, index) => (
            <mesh key={index} position={beam.position} quaternion={beam.rotation}>
              <cylinderGeometry args={[0.008, 0.018, beam.length, 4]} />
              <meshBasicMaterial
                color={['#d5ed9d', '#c8e3e8', '#e4bde2'][index % 3]}
                transparent
                opacity={0.45}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  );
}
