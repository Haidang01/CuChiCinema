/** Neutral center and a finite hit radius make releasing outside the wheel a cancellation. */
export function wheelOptionAt(x: number, y: number, count: number, radius = 82) {
  if (!count || !Number.isFinite(x) || !Number.isFinite(y)) return -1;
  let selected = -1;
  let nearest = 34;
  for (let index = 0; index < count; index++) {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
    const distance = Math.hypot(x - Math.cos(angle) * radius, y - Math.sin(angle) * radius);
    if (distance < nearest) {
      nearest = distance;
      selected = index;
    }
  }
  return selected;
}
