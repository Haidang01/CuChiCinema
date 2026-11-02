import { walkBounds, type Seat } from '@cineverse/shared';

/** One set of dimensions for the wall, camera, light source and DOM/WebGL screen. */
export function theaterDimensions(seats: Seat[]) {
  const bounds = walkBounds(seats);
  const halfWidth = Math.max(Math.abs(bounds.minX), bounds.maxX) + 0.5;
  // Leave dark masking and acoustic wall visible around the image, as in a real auditorium.
  const width = Math.max(3, (halfWidth * 2 - 0.5) * 0.84);
  const height = (width * 9) / 16;
  const highestSeat = Math.max(...seats.map((seat) => seat.y));
  // Match the lower image area to the rear-row eye line as the auditorium gets deeper.
  const screenY = Math.max(height / 2 + 0.85, highestSeat + 1.5 + height * 0.3);
  const screenDistance = Math.max(
    4.9,
    height * 1.25,
    (screenY - 1.5) / Math.tan((30 * Math.PI) / 180),
  );
  return {
    halfWidth,
    top: Math.max(screenY + height / 2 + 1.9, highestSeat + 5.5),
    rear: bounds.maxZ + 5,
    screen: { width, height, y: screenY, z: -screenDistance, pixelWidth: 960, pixelHeight: 540 },
  };
}
/** Approximate clearance from the avatar head in the row ahead to the lower image area. */
export function estimateSightline(seats: Seat[]) {
  if (seats.length < 2) return null;
  const screen = theaterDimensions(seats).screen;
  const targetY = screen.y - screen.height * 0.3;
  const rows = [...new Map(seats.map((seat) => [seat.row, seat])).values()].sort(
    (a, b) => a.row - b.row,
  );
  let minimum = Infinity;
  let recommendedRise = 0.35;
  let behindRow = '';
  for (let i = 1; i < rows.length; i++) {
    const rearRow = rows[i]!;
    const frontRow = rows[i - 1]!;
    const rearSeats = seats.filter((seat) => seat.row === rearRow.row);
    const frontSeats = seats.filter((seat) => seat.row === frontRow.row);
    for (const rearSeat of rearSeats) {
      const eye = rearSeat.y + 1.5;
      const t = (rearSeat.z - frontRow.z) / (rearSeat.z - screen.z);
      const xAtFront = rearSeat.x * (1 - t);
      const frontSeat = frontSeats.reduce((best, candidate) =>
        Math.abs(candidate.x - xAtFront) < Math.abs(best.x - xAtFront) ? candidate : best,
      );
      if (Math.abs(frontSeat.x - xAtFront) > 0.58) continue;
      const yAtFront = eye + (targetY - eye) * t;
      const clearance = yAtFront - (frontSeat.y + 1.68);
      if (clearance < minimum) {
        minimum = clearance;
        recommendedRise = rearSeat.y - frontSeat.y + (0.12 - clearance) / (1 - t);
        behindRow = rearRow.rowLabel;
      }
    }
  }
  if (!Number.isFinite(minimum)) return null;
  return {
    clearance: minimum,
    rowLabel: behindRow,
    recommendedRise: Math.max(0.35, recommendedRise),
  };
}
export type ScreenDimensions = ReturnType<typeof theaterDimensions>['screen'];
/** Convert clip coordinates to CSS pixels, retaining perspective division in the fourth row. */
export function clipToCssMatrix(e: readonly number[], width: number, height: number): number[] {
  const scale = e[15]!;
  if (!Number.isFinite(scale) || scale <= 0) return [];
  const values = new Array<number>(16).fill(0);
  for (const column of [0, 1, 3]) {
    const index = column * 4;
    values[index] = (width * 0.5 * (e[index]! + e[index + 3]!)) / scale;
    values[index + 1] = (height * 0.5 * (-e[index + 1]! + e[index + 3]!)) / scale;
    values[index + 3] = e[index + 3]! / scale;
  }
  values[10] = 1;
  return values;
}
