export type ViewMode = 'explore' | 'walk' | 'focus' | 'first' | 'seated';
export const cameraZoom = { min: 0.4, max: 2.4 };
export function clampZoom(value: number) {
  return Math.max(cameraZoom.min, Math.min(cameraZoom.max, value));
}
export function clampPitch(mode: ViewMode, value: number) {
  const [min, max] =
    mode === 'first' || mode === 'seated'
      ? [-1.2, 1.2]
      : mode === 'walk'
        ? [-0.27, 1.05]
        : mode === 'explore'
          ? [-0.34, 0.98]
          : [-0.08, 1.05];
  return Math.max(min!, Math.min(max!, value));
}
export function orbitElevation(mode: ViewMode, pitch: number) {
  return (mode === 'walk' ? 0.35 : mode === 'explore' ? 0.42 : 0.14) + clampPitch(mode, pitch);
}
export function firstPersonFov(zoom: number) {
  const value = clampZoom(zoom);
  return value <= 1
    ? 30 + ((value - cameraZoom.min) / (1 - cameraZoom.min)) * 32
    : 62 + ((value - 1) / (cameraZoom.max - 1)) * 33;
}
/** Yaw zero looks toward -Z in every mode; orbit stays on a sphere without wall clamps. */
export function orbitOffset(
  yaw: number,
  elevation: number,
  distance: number,
): [number, number, number] {
  return [
    -Math.sin(yaw) * distance * Math.cos(elevation),
    Math.sin(elevation) * distance,
    Math.cos(yaw) * distance * Math.cos(elevation),
  ];
}

/** Fit all four screen corners, including perspective depth when the view is tilted. */
export function screenFitDistance(
  width: number,
  height: number,
  aspect: number,
  yaw: number,
  elevation: number,
) {
  const tangent = Math.tan((25 * Math.PI) / 180);
  let distance = 0;
  for (const x of [-width / 2, width / 2])
    for (const y of [-height / 2, height / 2]) {
      const horizontal = Math.cos(yaw) * x;
      const vertical = Math.sin(elevation) * Math.sin(yaw) * x + Math.cos(elevation) * y;
      const depth = -Math.sin(yaw) * Math.cos(elevation) * x + Math.sin(elevation) * y;
      distance = Math.max(
        distance,
        Math.abs(horizontal) / (tangent * aspect) + depth,
        Math.abs(vertical) / tangent + depth,
      );
    }
  return distance * 1.06;
}
