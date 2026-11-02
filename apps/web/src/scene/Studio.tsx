import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import type { Group } from 'three';
import type { Appearance } from '@cineverse/shared';
import Avatar from './Avatar';

export default function Studio({ appearance }: { appearance: Appearance }) {
  const subject = useRef<Group>(null);
  const invalidate = useRef<(() => void) | null>(null);
  const drag = useRef<{ id: number; x: number } | null>(null);
  const rotate = (angle: number) => {
    if (subject.current) {
      subject.current.rotation.y += angle;
      invalidate.current?.();
    }
  };
  return (
    <div
      className="studio-canvas"
      role="group"
      tabIndex={0}
      aria-label="Xem trước nhân vật 3D. Kéo hoặc dùng phím mũi tên trái phải để xoay."
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          rotate(event.key === 'ArrowLeft' ? -0.2 : 0.2);
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        drag.current = { id: event.pointerId, x: event.clientX };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const previous = drag.current;
        if (previous?.id === event.pointerId) {
          rotate((event.clientX - previous.x) * 0.012);
          previous.x = event.clientX;
        }
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
    >
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.4, 6.5], fov: 35 }}
        onCreated={(state) => {
          state.camera.lookAt(0, 1, 0);
          invalidate.current = state.invalidate;
        }}
      >
        <color attach="background" args={['#34334c']} />
        <ambientLight intensity={1.6} />
        <directionalLight
          position={[3, 6, 4]}
          intensity={3}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <pointLight position={[-3, 3, -1]} color="#c3b0ed" intensity={12} />
        <group position={[0, -0.5, 0]}>
          <group ref={subject} rotation={[0, -0.22, 0]}>
            <Avatar appearance={appearance} />
          </group>
          <mesh position={[0, -0.13, 0]} receiveShadow>
            <cylinderGeometry args={[1.2, 1.3, 0.2, 64]} />
            <meshStandardMaterial color="#77718b" roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.21, 0]}>
            <cylinderGeometry args={[1.31, 1.31, 0.06, 64]} />
            <meshStandardMaterial color="#d5b578" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
        <mesh position={[0, -0.75, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#34334c" />
        </mesh>
        <mesh position={[0, 1.4, -1.2]}>
          <torusGeometry args={[1.75, 0.025, 8, 80]} />
          <meshStandardMaterial color="#d5b578" emissive="#d5b578" emissiveIntensity={0.5} />
        </mesh>
      </Canvas>
    </div>
  );
}
