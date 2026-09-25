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

/** Visual centre of a ring, used to place its label. */
export function ringCentroid(ring: Ring): Point {
  // The signed-area centroid is the true centroid, but it falls outside
  // strongly concave shapes — which puts a lot's label on its neighbour. The
  // bounding-box centre is less correct and more useful here.
  const { minX, minY, maxX, maxY } = ringBounds(ring);
  return [(minX + maxX) / 2, (minY + maxY) / 2];
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

