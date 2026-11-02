import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
export default function ActorLabel({
  name,
  mine,
  emoji,
}: {
  name: string;
  mine: boolean;
  emoji?: string;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = mine ? '#263e25e8' : '#111d18dd';
    ctx.beginPath();
    ctx.roundRect(16, 60, 480, 76, 30);
    ctx.fill();
    ctx.strokeStyle = mine ? '#cfeb98' : '#66816c';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = mine ? '#e8ffc6' : '#eff5e8';
    let size = 36;
    do {
      ctx.font = `600 ${size--}px "Segoe UI", sans-serif`;
    } while (ctx.measureText(name).width > 450 && size > 15);
    ctx.fillText(name, 256, 98);
    if (emoji) {
      ctx.font = '54px "Segoe UI Emoji",sans-serif';
      ctx.fillText(emoji, 256, 30);
    }
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    return map;
  }, [name, mine, emoji]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[0, 3.1, 0]} scale={[1.7, 0.53, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}
