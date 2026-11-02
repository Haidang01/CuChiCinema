import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Matrix4 } from 'three';
import { type ScreenDimensions, clipToCssMatrix } from './screen-projection';
/** Transform the existing iframe in place; never read or copy cross-origin video pixels. */
export default function ScreenPortal({
  surface,
  screen,
}: {
  surface: HTMLDivElement;
  screen: ScreenDimensions;
}) {
  const { camera, size, invalidate } = useThree();
  const matrices = useMemo(
    () => ({
      view: new Matrix4(),
      clip: new Matrix4(),
      model: new Matrix4().set(
        screen.width / screen.pixelWidth,
        0,
        0,
        -screen.width / 2,
        0,
        -screen.height / screen.pixelHeight,
        0,
        screen.y + screen.height / 2,
        0,
        0,
        1,
        screen.z,
        0,
        0,
        0,
        1,
      ),
    }),
    [screen],
  );
  useEffect(() => {
    invalidate();
    return () => {
      const player = surface.querySelector<HTMLElement>('.cinema-screen-object');
      if (player) {
        player.style.removeProperty('transform');
        player.style.removeProperty('visibility');
      }
      surface.removeAttribute('data-screen-mounted');
    };
  }, [surface, invalidate]);
  useFrame(() => {
    const player = surface.querySelector<HTMLElement>('.cinema-screen-object');
    if (!player) return;
    camera.updateMatrixWorld();
    matrices.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    matrices.clip.multiplyMatrices(matrices.view, matrices.model);
    const values = clipToCssMatrix(matrices.clip.elements, size.width, size.height);
    const visible = camera.position.z > screen.z && values.length === 16;
    player.style.visibility = visible ? 'visible' : 'hidden';
    if (visible) {
      player.style.transform = `matrix3d(${values.join(',')})`;
      surface.dataset.screenMounted = 'true';
    }
  });
  return null;
}
