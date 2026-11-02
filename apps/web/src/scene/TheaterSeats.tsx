import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef, useMemo } from 'react';
import { BoxGeometry, MeshStandardMaterial, InstancedMesh, Matrix4, CanvasTexture, SRGBColorSpace, Color, type Group } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { RoomSnapshot } from '@cineverse/shared';
import { theaterDimensions } from './screen-projection';
import { useEffect } from 'react';
// Share upholstery geometry/materials across chairs; no image downloads or heavy postprocessing.
export default function TheaterSeats({
  snapshot,
  userId,
  onSeat,
}: {
  snapshot: RoomSnapshot;
  userId: string;
  onSeat: (id: string) => void;
}) {
  const chairs = useRef<(Group | null)[]>([]);
  const screenZ = theaterDimensions(snapshot.seats).screen.z;
  const rowMarkers = useMemo(() => {
    const unique = [...new Map(snapshot.seats.map((seat) => [seat.row, seat])).values()];
    return unique.map((seat) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 72;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#17202ddd';
      ctx.beginPath();
      ctx.roundRect(8, 8, 112, 56, 18);
      ctx.fill();
      ctx.strokeStyle = '#d6b878';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#fff1c9';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seat.rowLabel, 64, 37);
      const texture = new CanvasTexture(canvas);
      texture.colorSpace = SRGBColorSpace;
      return { row: seat.row, label: seat.rowLabel, y: seat.y, z: seat.z, texture };
    });
  }, [snapshot.seats]);
  useEffect(() => () => rowMarkers.forEach((marker) => marker.texture.dispose()), [rowMarkers]);
  useFrame(({ camera }) => {
    if (snapshot.seats.length > 80) return;
    snapshot.seats.forEach((seat, index) => {
      const chair = chairs.current[index];
      if (chair)
        chair.visible =
          (camera.position.x - seat.x) ** 2 +
            (camera.position.y - seat.y - 0.85) ** 2 +
            (camera.position.z - seat.z) ** 2 >
          0.85 ** 2;
    });
  });
  const assets = useMemo(
    () => ({
      cushion: new RoundedBoxGeometry(
        snapshot.room.chairStyle === 'sofa'
          ? 1.08
          : snapshot.room.chairStyle === 'recliner'
            ? 1.04
            : 0.94,
        snapshot.room.chairStyle === 'recliner' ? 0.28 : 0.22,
        0.83,
        3,
        snapshot.room.chairStyle === 'pod' ? 0.16 : 0.09,
      ),
      back: new RoundedBoxGeometry(
        snapshot.room.chairStyle === 'club' || snapshot.room.chairStyle === 'pod' ? 1.06 : 0.96,
        snapshot.room.chairStyle === 'retro' ? 1.2 : 0.98,
        snapshot.room.chairStyle === 'recliner' ? 0.32 : 0.25,
        3,
        snapshot.room.chairStyle === 'pod' ? 0.18 : 0.1,
      ),
      head: new RoundedBoxGeometry(0.77, 0.24, 0.27, 2, 0.09),
      arm: new RoundedBoxGeometry(0.14, 0.17, 0.9, 2, 0.055),
      base: new BoxGeometry(0.82, 0.08, 0.65),
      velvet: new MeshStandardMaterial({
        color:
          snapshot.room.type === 'vip'
            ? '#48584f'
            : snapshot.room.type === 'lounge'
              ? '#68504c'
              : (snapshot.room.chairColor ?? '#4e3644'),
        roughness: 0.96,
      }),
      vip: new MeshStandardMaterial({
        color: snapshot.room.type === 'vip' ? '#c3a26b' : (snapshot.room.chairColor ?? '#806b50'),
        roughness: 0.78,
        metalness: 0.08,
      }),
      seam: new MeshStandardMaterial({ color: '#9cb6a1', roughness: 0.9 }),
      shell: new MeshStandardMaterial({ color: '#242a30', roughness: 0.85 }),
      metal: new MeshStandardMaterial({ color: '#393b40', metalness: 0.28, roughness: 0.72 }),
      selected: new MeshStandardMaterial({ color: '#ba8850', roughness: 0.7 }),
      occupied: new MeshStandardMaterial({ color: '#aa5558', roughness: 0.84 }),
    }),
    [snapshot.room.type, snapshot.room.chairStyle, snapshot.room.chairColor],
  );
  useEffect(() => () => Object.values(assets).forEach((resource) => resource.dispose()), [assets]);
  if (snapshot.seats.length > 80)
    return <group><RowMarkers markers={rowMarkers} /><LargeTheaterSeats snapshot={snapshot} onSeat={onSeat} assets={assets} screenZ={screenZ} /></group>;
  return (
    <group>
      <RowMarkers markers={rowMarkers} />
      {snapshot.seats.map((seat, index) => {
        const mine = snapshot.participants.some(
          (person) => person.seatId === seat.id && person.userId === userId,
        );
        const occupied = snapshot.participants.some((person) => person.seatId === seat.id);
        return (
          <group
            key={seat.id}
            ref={(node) => {
              chairs.current[index] = node;
            }}
            position={[seat.x, seat.y, seat.z]}
            rotation={[0, Math.atan2(seat.x, seat.z - screenZ), 0]}
            onClick={(event) => {
              event.stopPropagation();
              if (event.delta < 7) onSeat(seat.id);
            }}
            dispose={null}
          >
            <mesh geometry={assets.base} material={assets.shell} position={[0, 0.26, 0]} />
            {[-0.31, 0.31].map((x) => (
              <mesh key={x} position={[x, 0.14, 0.12]} material={assets.shell}>
                <boxGeometry args={[0.07, 0.28, 0.5]} />
              </mesh>
            ))}
            <mesh
              geometry={assets.cushion}
              material={mine ? assets.selected : occupied ? assets.occupied : seat.kind === 'vip' ? assets.vip : assets.velvet}
              position={[0, 0.48, -0.06]}
              castShadow
              receiveShadow
            />
            <mesh
              geometry={assets.back}
              material={assets.metal}
              position={[0, 0.99, 0.36]}
              rotation={[-0.09, 0, 0]}
              castShadow
            />
            <mesh
              geometry={assets.back}
              material={seat.kind === 'vip' ? assets.vip : assets.velvet}
              scale={seat.kind === 'vip' ? [0.94, 0.92, 0.94] : seat.kind === 'loveseat' ? [1.08, 0.84, 0.9] : [0.88, 0.84, 0.9]}
              position={[0, 0.99, 0.4]}
              rotation={[-0.09, 0, 0]}
            />
            <mesh
              geometry={assets.back}
              material={assets.velvet}
              scale={[0.88, 0.84, 0.9]}
              position={[0, 0.99, 0.31]}
              rotation={[-0.09, 0, 0]}
            />
            <mesh
              geometry={assets.head}
              material={seat.kind === 'vip' ? assets.vip : assets.velvet}
              position={[0, 1.31, 0.22]}
            />
            {[-0.55, 0.55].map((x) => (
              <group key={x}>
                <mesh geometry={assets.arm} material={assets.shell} position={[x, 0.67, 0]} />
                <mesh position={[x, 0.765, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.043, 0.012, 6, 16]} />
                  <meshStandardMaterial color="#a78350" metalness={0.7} roughness={0.4} />
                </mesh>
              </group>
            ))}
            <mesh position={[0, 0.99, 0.5]}>
              <boxGeometry args={[0.36, 0.16, 0.01]} />
              <meshStandardMaterial color="#362c35" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.99, 0.508]}>
              <boxGeometry args={[0.2, 0.018, 0.005]} />
              <meshBasicMaterial color="#d9dec5" />
            </mesh>
            {mine ? (
              <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.5, 0.525, 32]} />
                <meshBasicMaterial color="#f8ce86" />
              </mesh>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}

function RowMarkers({ markers }: { markers: { row: number; label: string; y: number; z: number; texture: CanvasTexture }[] }) {
  return <group>{markers.map((marker) => <mesh key={marker.row} position={[0, marker.y + 0.035, marker.z - 0.62]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
    <planeGeometry args={[0.48, 0.28]} />
    <meshBasicMaterial map={marker.texture} transparent depthWrite={false} />
  </mesh>)}</group>;
}

function LargeTheaterSeats({
  snapshot,
  onSeat,
  assets,
  screenZ,
}: {
  snapshot: RoomSnapshot;
  onSeat: (id: string) => void;
  assets: {
    base: BoxGeometry;
    cushion: BoxGeometry;
    back: BoxGeometry;
    shell: MeshStandardMaterial;
    velvet: MeshStandardMaterial;
  };
  screenZ: number;
}) {
  const base = useRef<InstancedMesh>(null),
    cushion = useRef<InstancedMesh>(null),
    back = useRef<InstancedMesh>(null);
  const hidden = useRef(new Set<number>());
  const scratch = useMemo(() => new Matrix4(), []);
  useLayoutEffect(() => {
    hidden.current.clear();
    const matrix = new Matrix4();
    snapshot.seats.forEach((seat, i) => {
      const angle = Math.atan2(seat.x, seat.z - screenZ);
      matrix.makeRotationY(angle).setPosition(seat.x, seat.y + 0.2, seat.z);
      base.current?.setMatrixAt(i, matrix);
      matrix.makeRotationY(angle).setPosition(
        seat.x - Math.sin(angle) * 0.06,
        seat.y + 0.48,
        seat.z - Math.cos(angle) * 0.06,
      );
      cushion.current?.setMatrixAt(i, matrix);
      matrix.makeRotationY(angle).setPosition(
        seat.x + Math.sin(angle) * 0.36,
        seat.y + 0.99,
        seat.z + Math.cos(angle) * 0.36,
      );
      back.current?.setMatrixAt(i, matrix);
      const occupied = snapshot.participants.some((person) => person.seatId === seat.id);
      const tint = occupied ? '#aa5558' : seat.kind === 'vip' ? '#c3a26b' : seat.kind === 'loveseat' ? '#9b75a8' : snapshot.room.chairColor ?? '#4e3644';
      cushion.current?.setColorAt(i, new Color(tint));
      back.current?.setColorAt(i, new Color(tint));
    });
    for (const mesh of [base.current, cushion.current, back.current])
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
      }, [snapshot.seats, snapshot.participants, snapshot.room.chairColor, screenZ]);
  useFrame(({ camera }) => {
    let changed = false;
    snapshot.seats.forEach((seat, index) => {
      const close =
        (camera.position.x - seat.x) ** 2 +
          (camera.position.y - seat.y - 0.85) ** 2 +
          (camera.position.z - seat.z) ** 2 <
        0.85 ** 2;
      if (close === hidden.current.has(index)) return;
      if (close) hidden.current.add(index);
      else hidden.current.delete(index);
      const parts = [
        [base.current, 0.2, 0],
        [cushion.current, 0.48, -0.06],
        [back.current, 0.99, 0.36],
      ] as const;
      for (const [mesh, y, z] of parts) {
        if (!mesh) continue;
        if (close) scratch.makeScale(0, 0, 0);
        else scratch.makeRotationY(Math.atan2(seat.x, seat.z - screenZ)).setPosition(
          seat.x + Math.sin(Math.atan2(seat.x, seat.z - screenZ)) * z,
          seat.y + y,
          seat.z + Math.cos(Math.atan2(seat.x, seat.z - screenZ)) * z,
        );
        mesh.setMatrixAt(index, scratch);
      }
      changed = true;
    });
    if (changed)
      for (const mesh of [base.current, cushion.current, back.current])
        if (mesh) mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta < 7 && e.instanceId !== undefined) {
          const seat = snapshot.seats[e.instanceId];
          if (seat) onSeat(seat.id);
        }
      }}
      dispose={null}
    >
      <instancedMesh ref={base} args={[assets.base, assets.shell, snapshot.seats.length]} />
      <instancedMesh ref={cushion} args={[assets.cushion, assets.velvet, snapshot.seats.length]} />
      <instancedMesh ref={back} args={[assets.back, assets.velvet, snapshot.seats.length]} />
    </group>
  );
}
