/**
 * Plane geometry for the site map.
 *
 * Everything here works in the site's LOCAL coordinate space — metres from the
 * site origin, Y growing downward to match SVG. There is no projection and no
 * georeferencing; see the migration that adds `site.boundary` for the contract.
 */

/** A vertex pair, `[x, y]`, stored exactly this way in JSONB. */
export type Point = readonly [number, number];

/**
 * A closed ring, first vertex NOT repeated at the end.
 *
 * Stored as `unknown` in the database, so anything read back has to go through
 * `parseRing()` before it is trusted.
 */
export type Ring = Point[];

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Validates a ring read out of JSONB.
 *
 * The database CHECK only enforces "array of length >= 3" — it cannot see
 * inside the elements, so a row could still hold `[1, 2, 3]` or a vertex with
 * a null. Returns null rather than throwing so one malformed lot cannot blank
 * the whole map.
 */
export function parseRing(value: unknown): Ring | null {
  if (!Array.isArray(value) || value.length < 3) return null;

  const ring: Point[] = [];
  for (const vertex of value) {
    if (!Array.isArray(vertex) || vertex.length < 2) return null;
    const [x, y] = vertex;
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    ring.push([x, y]);
  }
  return ring;
}

/** Serialises a ring into an SVG `points` / `polygon` attribute value. */
export function toSvgPoints(ring: Ring): string {
  return ring.map(([x, y]) => `${x},${y}`).join(' ');
}

export function ringBounds(ring: Ring): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function mergeBounds(all: Bounds[]): Bounds | null {
  if (all.length === 0) return null;
  return all.reduce((acc, b) => ({
    minX: Math.min(acc.minX, b.minX),
    minY: Math.min(acc.minY, b.minY),
    maxX: Math.max(acc.maxX, b.maxX),
    maxY: Math.max(acc.maxY, b.maxY),
  }));
}

/** Visual centre of a ring, used to place its label. */
export function ringCentroid(ring: Ring): Point {
  // The signed-area centroid is the true centroid, but it falls outside
  // strongly concave shapes — which puts a lot's label on its neighbour. The
  // bounding-box centre is less correct and more useful here.
  const { minX, minY, maxX, maxY } = ringBounds(ring);
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

/**
 * Area enclosed by a ring, via the shoelace formula.
 *
 * Absolute value, so winding order does not matter. Because the local space is
 * metres, this comes out in square metres and can be compared directly against
 * `property_lot.area_size` — which is how a mis-drawn lot gets caught.
 */
export function ringArea(ring: Ring): number {
  let twiceArea = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    twiceArea += x1 * y2 - x2 * y1;
  }
  return Math.abs(twiceArea) / 2;
}

/**
 * How far a drawn shape disagrees with its recorded area, as a fraction.
 *
 * `0.04` means the polygon encloses 4% more or less than `area_size` says.
 * Returns null when either figure is missing or zero.
 */
export function areaDiscrepancy(ring: Ring, recordedArea: number): number | null {
  if (!Number.isFinite(recordedArea) || recordedArea <= 0) return null;
  const drawn = ringArea(ring);
  if (drawn <= 0) return null;
  return Math.abs(drawn - recordedArea) / recordedArea;
}

/** Anything past this is flagged in the UI as geometry worth re-checking. */
export const AREA_TOLERANCE = 0.05;

/**
 * A `viewBox` covering `bounds` with a margin, expressed in local units.
 *
 * The margin is proportional so it looks the same whether a site spans 40m or
 * 400m, with a floor so a degenerate (zero-width) site still renders.
 */
export function fitViewBox(bounds: Bounds, marginRatio = 0.04, extraTopRatio = 0): string {
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const span = Math.max(width, height);
  const margin = span * marginRatio;
  // Headroom above the plan so a lot on the top row has somewhere to put its
  // detail card. The card is positioned in screen pixels and the viewBox in
  // local units, so this cannot be exact — the card also flips below its lot
  // when it would still overflow.
  const extraTop = span * extraTopRatio;

  const x = bounds.minX - margin;
  const y = bounds.minY - margin - extraTop;
  return `${x} ${y} ${width + margin * 2} ${height + margin * 2 + extraTop}`;
}

export function calculatePolygonAreaSqm(points: readonly [number, number][]): number {
  if (points.length < 3) return 0;
  // Project [lng, lat] coordinates to local metric space around initial vertex
  const [lng0, lat0] = points[0];
  const metersPerLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const metersPerLat = 110574;

  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1Deg, y1Deg] = points[i];
    const [x2Deg, y2Deg] = points[(i + 1) % points.length];
    const x1 = (x1Deg - lng0) * metersPerLng;
    const y1 = (y1Deg - lat0) * metersPerLat;
    const x2 = (x2Deg - lng0) * metersPerLng;
    const y2 = (y2Deg - lat0) * metersPerLat;
    twiceArea += x1 * y2 - x2 * y1;
  }
  return Math.abs(twiceArea) / 2;
}

