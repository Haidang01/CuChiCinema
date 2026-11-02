import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import { ACESFilmicToneMapping } from 'three';
import type { RoomSnapshot, ReactionEvent, AvatarActionEvent } from '@cineverse/shared';
import MovingAvatar from './MovingAvatar';
import VideoScreen from './VideoScreen';
import ScreenPortal from './ScreenPortal';
import CinemaCamera, { type CameraMode, type CameraRig } from './CinemaCamera';
import CameraGestures from './CameraGestures';
import TheaterSeats from './TheaterSeats';
import TheaterInterior from './TheaterInterior';
import TheaterStage from './TheaterStage';
import StageEffects from './StageEffects';
import ScreenLight from './ScreenLight';
import { theaterDimensions } from './screen-projection';
function Refresh({ revision }: { revision: number }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => invalidate(), [revision, invalidate]);
  return null;
}
export default function Cinema({
  snapshot,
  userId,
  onSeat,
  video,
  youtubeSurface,
  mode,
  clockOffset,
  onFloor,
  lighting = true,
  party = false,
  reactions = [],
  actions = [],
  rig,
  cameraRevision,
  onHeading,
  quality = 'high',
}: {
  snapshot: RoomSnapshot;
  userId: string;
  onSeat: (id: string) => void;
  video: HTMLVideoElement | null;
  youtubeSurface: HTMLDivElement | null;
  mode: CameraMode;
  clockOffset: number;
  onFloor: (x: number, z: number) => void;
  lighting?: boolean;
  party?: boolean;
  reactions?: ReactionEvent[];
  actions?: AvatarActionEvent[];
  rig: MutableRefObject<CameraRig>;
  cameraRevision: number;
  onHeading: (yaw: number) => void;
  quality?: 'smooth' | 'high';
}) {
  const shape = useMemo(() => theaterDimensions(snapshot.seats), [snapshot.seats]);
  const imageUrl =
    snapshot.playback.kind === 'image' ? (snapshot.playback.sourceUrl ?? undefined) : undefined;
  const allowed = () => performance.now() > (rig.current.suppressUntil ?? 0);
  return (
    <div className="cinema-canvas">
      <Canvas
        shadows={quality === 'high'}
        frameloop="demand"
        dpr={quality === 'high' ? [1.5, 2] : 1}
        camera={{ position: [0, 5, 12], fov: 50, near: 0.06, far: 1500 }}
        gl={{
          alpha: true,
          antialias: true,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
      >
        <color attach="background" args={['#11161d']} />
        {mode !== 'explore' && mode !== 'focus' ? (
          <fog
            attach="fog"
            args={['#252c32', 26, Math.max(65, ...snapshot.seats.map((s) => s.z + 40))]}
          />
        ) : null}
        <Refresh revision={cameraRevision} />
        <CinemaCamera
          snapshot={snapshot}
          userId={userId}
          mode={mode}
          clockOffset={clockOffset}
          rig={rig}
        />
        {youtubeSurface ? <ScreenPortal surface={youtubeSurface} screen={shape.screen} /> : null}
        <CameraGestures onHeading={onHeading} rig={rig} mode={mode} />
        <ambientLight intensity={lighting ? 0.14 : 0.055} color="#c4cbd5" />
        <hemisphereLight args={['#b9c7df', '#30252b', lighting ? 0.3 : 0.1]} />
        <directionalLight
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={7}
          shadow-camera-bottom={-7}
          shadow-camera-far={25}
          shadow-normalBias={0.035}
          position={[1, 5, -3]}
          intensity={lighting ? 0.32 : 0.1}
          color="#ffe0b8"
        />
        <ScreenLight
          screen={shape.screen}
          video={video}
          imageUrl={imageUrl}
          embedded={!!youtubeSurface}
          active={!!snapshot.playback.sourceUrl}
        />
        <pointLight
          position={[-4, 4, 3]}
          intensity={lighting ? 8 : 1.5}
          distance={13}
          decay={2}
          color={party ? '#c285ef' : '#ffc88d'}
        />
        <pointLight
          position={[4, 4, 3]}
          intensity={lighting ? 8 : 1.5}
          distance={13}
          decay={2}
          color={party ? '#89cce0' : '#ffc88d'}
        />
        <TheaterStage
          party={party && !snapshot.stage?.settings.enabled}
          halfWidth={shape.halfWidth}
          screen={shape.screen}
        />
        {snapshot.stage ? (
          <StageEffects settings={snapshot.stage.settings} clockOffset={clockOffset} />
        ) : null}
        <TheaterInterior
          snapshot={snapshot}
          lighting={lighting}
          onFloor={(x, z) => {
            if (allowed() && mode !== 'focus' && mode !== 'seated') onFloor(x, z);
          }}
        />
        <VideoScreen
          key={snapshot.playback.sourceUrl}
          screen={shape.screen}
          embedded={!!youtubeSurface}
          video={video}
          imageUrl={
            snapshot.playback.kind === 'image'
              ? (snapshot.playback.sourceUrl ?? undefined)
              : undefined
          }
        />
        {mode !== 'focus' ? (
          <TheaterSeats
            snapshot={snapshot}
            userId={userId}
            onSeat={(id) => {
              if (allowed()) onSeat(id);
            }}
          />
        ) : null}
        {snapshot.participants.map((person, index) => (
          <MovingAvatar
            key={person.userId}
            action={actions.find((action) => action.userId === person.userId)}
            person={person}
            seats={snapshot.seats}
            index={index}
            clockOffset={clockOffset}
            hidden={
              (mode === 'seated' || mode === 'first' || mode === 'focus') &&
              person.userId === userId
            }
            mine={person.userId === userId}
            reaction={[...reactions]
              .reverse()
              .find((reaction) => reaction.userId === person.userId)}
          />
        ))}
      </Canvas>
    </div>
  );
}
