export type ScreenSample = { r: number; g: number; b: number; luminance: number };
/** Tiny, infrequent CPU samples; never copy frames out of an embedded iframe. */
export function sampleScreenZones(pixels: Uint8ClampedArray, width: number, height: number) {
  if (width < 2 || height < 1 || pixels.length !== width * height * 4) return null;
  return [0, 1].map((side) => {
    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        if ((x < width / 2 ? 0 : 1) !== side) continue;
        const index = (y * width + x) * 4;
        r += pixels[index]!;
        g += pixels[index + 1]!;
        b += pixels[index + 2]!;
        count++;
      }
    r /= count * 255;
    g /= count * 255;
    b /= count * 255;
    return { r, g, b, luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b };
  });
}
