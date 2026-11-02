import type { Appearance } from '@cineverse/shared';

export const palette = {
  skin: { porcelain: '#f2cfb9', sand: '#dca77d', amber: '#b77d52', cocoa: '#764c39' },
  hairColor: { espresso: '#282130', chestnut: '#774a35', silver: '#bac0d3' },
  outfit: { midnight: '#6378a5', rose: '#bc7785', sage: '#739f91', cream: '#e7d8b9' },
};
type Point = [number, number, number];
function Ball({ at, scale, color }: { at: Point; scale: Point; color: string }) {
  return (
    <mesh position={at} scale={scale} castShadow>
      <sphereGeometry args={[1, 24, 18]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}
export default function Avatar({
  appearance,
  seated = false,
}: {
  appearance: Appearance;
  seated?: boolean;
}) {
  const skin = palette.skin[appearance.skin];
  const hair = palette.hairColor[appearance.hairColor];
  const shirt = palette.outfit[appearance.outfit];
  return (
    <group position={[0, seated ? -0.32 : 0, 0]}>
      <Ball at={[0, 2.08, 0]} scale={[0.43, 0.5, 0.4]} color={skin} />
      <Ball at={[-0.43, 2.07, 0]} scale={[0.075, 0.13, 0.08]} color={skin} />
      <Ball at={[0.43, 2.07, 0]} scale={[0.075, 0.13, 0.08]} color={skin} />
      <Ball at={[0, 2.4, -0.04]} scale={[0.46, 0.25, 0.42]} color={hair} />
      {appearance.hair !== 'crop' ? (
        <>
          <Ball at={[-0.37, 2.17, -0.12]} scale={[0.13, 0.38, 0.32]} color={hair} />
          <Ball at={[0.37, 2.17, -0.12]} scale={[0.13, 0.38, 0.32]} color={hair} />
        </>
      ) : null}
      {appearance.hair === 'bun' ? (
        <Ball at={[0, 2.57, -0.22]} scale={[0.23, 0.23, 0.23]} color={hair} />
      ) : null}
      <Ball at={[-0.15, 2.12, 0.37]} scale={[0.035, 0.05, 0.025]} color="#282130" />
      <Ball at={[0.15, 2.12, 0.37]} scale={[0.035, 0.05, 0.025]} color="#282130" />
      <Ball at={[0, 2.02, 0.395]} scale={[0.06, 0.065, 0.07]} color={skin} />
      <mesh position={[0, 1.93, 0.38]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.075, 0.012, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#8d524c" />
      </mesh>
      {appearance.accessory === 'glasses' ? (
        <group position={[0, 2.12, 0.41]}>
          {[-0.16, 0.16].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <torusGeometry args={[0.115, 0.017, 8, 24]} />
              <meshStandardMaterial color="#d6b578" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          <mesh>
            <boxGeometry args={[0.1, 0.025, 0.025]} />
            <meshStandardMaterial color="#d6b578" />
          </mesh>
        </group>
      ) : null}
      <Ball at={[0, 1.35, 0]} scale={[0.4, 0.5, 0.28]} color={shirt} />
      <Ball at={[0, 1.79, 0]} scale={[0.14, 0.14, 0.14]} color={skin} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Ball at={[side * 0.43, 1.38, 0]} scale={[0.14, 0.32, 0.14]} color={shirt} />
          <Ball at={[side * 0.47, 1.08, 0.04]} scale={[0.1, 0.14, 0.1]} color={skin} />
          <group position={[side * 0.2, 0.83, 0]} rotation={[seated ? -Math.PI / 2 : 0, 0, 0]}>
            <Ball at={[0, -0.28, 0]} scale={[0.17, 0.42, 0.18]} color="#34364e" />
            <Ball at={[0, -0.67, 0.08]} scale={[0.19, 0.12, 0.29]} color="#e6dfd6" />
          </group>
        </group>
      ))}
    </group>
  );
}
