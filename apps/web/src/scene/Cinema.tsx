import { Canvas } from '@react-three/fiber';
import type { RoomSnapshot } from '@cineverse/shared';
import Avatar from './Avatar';

export default function Cinema({
  snapshot,
  userId,
  onSeat,
}: {
  snapshot: RoomSnapshot;
  userId: string;
  onSeat: (id: string) => void;
}) {
  const furniture = [...new Set(snapshot.seats.map((seat) => seat.groupId))].map((id) =>
    snapshot.seats.filter((seat) => seat.groupId === id),
  );
  const color = { standard: '#91566d', vip: '#a78b60', couple: '#b5718c', lounge: '#6b968d' }[
    snapshot.room.type
  ];
  return (
    <div className="cinema-canvas">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [8, 7, 11], fov: 45, rotation: [-0.42, 0.53, 0.24] }}
        onCreated={({ camera }) => camera.lookAt(0, 0, -0.5)}
      >
        <color attach="background" args={['#202237']} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[0, 8, 3]} intensity={2.5} />
        <pointLight position={[0, 3, -5]} intensity={40} color="#b9c9ff" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
          <planeGeometry args={[16, 18]} />
          <meshStandardMaterial color="#353047" />
        </mesh>
        <mesh position={[0, 2, -5]}>
          <boxGeometry args={[9, 4.4, 0.15]} />
          <meshStandardMaterial color="#b8c8db" emissive="#6e819e" emissiveIntensity={0.6} />
        </mesh>
        {furniture.map((slots) => {
          const first = slots[0]!,
            last = slots.at(-1)!;
          const center = (first.x + last.x) / 2;
          const width = last.x - first.x + 1.15;
          return (
            <group
              key={first.groupId}
              position={[center, first.y, first.z]}
              rotation={[0, Math.PI, 0]}
            >
              <mesh position={[0, 0.4, 0]}>
                <boxGeometry args={[width, 0.25, 1]} />
                <meshStandardMaterial color={color} />
              </mesh>
              <mesh position={[0, 0.85, -0.4]}>
                <boxGeometry args={[width, 0.85, 0.22]} />
                <meshStandardMaterial color={color} />
              </mesh>
              {[-width / 2, width / 2].map((x) => (
                <mesh key={x} position={[x, 0.65, 0]}>
                  <boxGeometry args={[0.13, 0.25, 1]} />
                  <meshStandardMaterial color="#4d354a" />
                </mesh>
              ))}
              {slots.map((seat) => {
                const person = snapshot.participants.find((p) => p.seatId === seat.id);
                return (
                  <group
                    key={seat.id}
                    position={[center - seat.x, 0, 0]}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSeat(seat.id);
                    }}
                  >
                    <mesh position={[0, 0.56, 0]}>
                      <boxGeometry args={[1.05, 0.12, 0.9]} />
                      <meshStandardMaterial color={person?.userId === userId ? '#d5b578' : color} />
                    </mesh>
                    {person ? (
                      <group position={[0, 0.45, 0]} scale={0.6}>
                        <Avatar appearance={person.appearance} seated />
                      </group>
                    ) : null}
                  </group>
                );
              })}
            </group>
          );
        })}
      </Canvas>
    </div>
  );
}
