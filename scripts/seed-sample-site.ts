/**
 * scripts/seed-sample-site.ts
 *
 * Seeds three sample sites — Lui Pro, San Vicente 3, Murillo Old — each with
 * 10–15 pre-planned subdivisions in `site_subdivision` and 3 registered
 * `property_lot` records with mixed statuses so the site map has real colour
 * variation to render from day one.
 *
 * This is DEVELOPMENT DATA. Re-running is safe: sites are upserted by name and
 * their subdivisions / lots are replaced on every run.
 *
 * Usage:
 *   npm run seed:sample-site          seed (or re-seed) all three sites
 *   npm run seed:sample-site:clear    remove all three sites and their data
 *
 * Required env vars (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY;

const missing: string[] = [];
if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SECRET_KEY");
if (missing.length > 0) {
  console.error(`❌  Missing required environment variables:\n   ${missing.join("\n   ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

type Pt = [number, number];

/** Shoelace area — mirrors lib/geometry.ts so seeded area_size matches the polygon. */
function ringArea(ring: Pt[]): number {
  let twice = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

// ---------------------------------------------------------------------------
// Site data
// ---------------------------------------------------------------------------

type SubdivisionSeed = { block: number; lot: number; boundary: Pt[] };
type LotSeed = { block: number; lot: number; status: "Open" | "Reserved" | "Sold" | "Forfeited" };

interface SiteSeed {
  name: string;
  namePrefix: string;
  description: string;
  boundary: Pt[];
  pricePerSqm: number;
  subdivisions: SubdivisionSeed[];
  /** Exactly 3 lots — must match block/lot values that exist in subdivisions. */
  lots: LotSeed[];
}

// ---------------------------------------------------------------------------
// Lui Pro
// Irregular trapezoid, ~240×160 m local space.
// Block 1 (north, 8 lots) and Block 2 (south, 7 lots) split by a road corridor.
// ---------------------------------------------------------------------------

const LUI_PRO_BOUNDARY: Pt[] = [
  [0, 25],
  [50, 0],
  [240, 0],
  [240, 70],
  [240, 160],
  [180, 160],
  [0, 155],
];

const LUI_PRO_SUBDIVISIONS: SubdivisionSeed[] = [
  // Block 1 — North block (y: 4 to 74, split at y=38)
  { block: 1, lot: 1,  boundary: [[4, 25], [45, 4], [80, 4], [80, 38], [4, 38]] },
  { block: 1, lot: 2,  boundary: [[80, 4], [160, 4], [160, 38], [80, 38]] },
  { block: 1, lot: 3,  boundary: [[160, 4], [236, 4], [236, 38], [160, 38]] },
  { block: 1, lot: 4,  boundary: [[4, 38], [80, 38], [80, 74], [4, 74]] },
  { block: 1, lot: 5,  boundary: [[80, 38], [160, 38], [160, 74], [80, 74]] },
  { block: 1, lot: 6,  boundary: [[160, 38], [236, 38], [236, 74], [160, 74]] },
  // Block 2 — South block (y: 86 to 156, road corridor at y 74–86)
  { block: 2, lot: 1,  boundary: [[4, 86], [80, 86], [80, 120], [4, 120]] },
  { block: 2, lot: 2,  boundary: [[80, 86], [160, 86], [160, 120], [80, 120]] },
  { block: 2, lot: 3,  boundary: [[160, 86], [236, 86], [236, 120], [160, 120]] },
  { block: 2, lot: 4,  boundary: [[4, 120], [80, 120], [80, 156], [4, 156]] },
  { block: 2, lot: 5,  boundary: [[80, 120], [160, 120], [160, 156], [80, 156]] },
  { block: 2, lot: 6,  boundary: [[160, 120], [236, 120], [236, 156], [160, 156]] },
];

// ---------------------------------------------------------------------------
// San Vicente 3
// Wider rectangular parcel, ~300×140 m, three blocks.
// ---------------------------------------------------------------------------

const SAN_VICENTE_BOUNDARY: Pt[] = [
  [0, 0],
  [300, 0],
  [300, 140],
  [0, 140],
];

const SAN_VICENTE_SUBDIVISIONS: SubdivisionSeed[] = [
  // Block 1 — West block (x: 4 to 96, corridor at 96–104)
  { block: 1, lot: 1,  boundary: [[4, 4], [50, 4], [50, 70], [4, 70]] },
  { block: 1, lot: 2,  boundary: [[50, 4], [96, 4], [96, 70], [50, 70]] },
  { block: 1, lot: 3,  boundary: [[4, 70], [50, 70], [50, 136], [4, 136]] },
  { block: 1, lot: 4,  boundary: [[50, 70], [96, 70], [96, 136], [50, 136]] },
  // Block 2 — Central block (x: 104 to 196, corridor at 196–204)
  { block: 2, lot: 1,  boundary: [[104, 4], [150, 4], [150, 70], [104, 70]] },
  { block: 2, lot: 2,  boundary: [[150, 4], [196, 4], [196, 70], [150, 70]] },
  { block: 2, lot: 3,  boundary: [[104, 70], [150, 70], [150, 136], [104, 136]] },
  { block: 2, lot: 4,  boundary: [[150, 70], [196, 70], [196, 136], [150, 136]] },
  // Block 3 — East block (x: 204 to 296)
  { block: 3, lot: 1,  boundary: [[204, 4], [250, 4], [250, 70], [204, 70]] },
  { block: 3, lot: 2,  boundary: [[250, 4], [296, 4], [296, 70], [250, 70]] },
  { block: 3, lot: 3,  boundary: [[204, 70], [250, 70], [250, 136], [204, 136]] },
  { block: 3, lot: 4,  boundary: [[250, 70], [296, 70], [296, 136], [250, 136]] },
];

// ---------------------------------------------------------------------------
// Murillo Old
// Angled parallelogram, ~220×180 m, two blocks with a diagonal road.
// ---------------------------------------------------------------------------

const MURILLO_BOUNDARY: Pt[] = [
  [30, 0],
  [220, 0],
  [220, 180],
  [0, 180],
  [0, 30],
];

const MURILLO_SUBDIVISIONS: SubdivisionSeed[] = [
  // Block 1 — North block (y: 4 to 84, split at y=44)
  { block: 1, lot: 1,  boundary: [[4, 26], [26, 4], [74, 4], [74, 44], [4, 44]] },
  { block: 1, lot: 2,  boundary: [[74, 4], [145, 4], [145, 44], [74, 44]] },
  { block: 1, lot: 3,  boundary: [[145, 4], [216, 4], [216, 44], [145, 44]] },
  { block: 1, lot: 4,  boundary: [[4, 44], [74, 44], [74, 84], [4, 84]] },
  { block: 1, lot: 5,  boundary: [[74, 44], [145, 44], [145, 84], [74, 84]] },
  { block: 1, lot: 6,  boundary: [[145, 44], [216, 44], [216, 84], [145, 84]] },
  // Block 2 — South block (y: 96 to 176, road corridor at y 84–96)
  { block: 2, lot: 1,  boundary: [[4, 96], [74, 96], [74, 136], [4, 136]] },
  { block: 2, lot: 2,  boundary: [[74, 96], [145, 96], [145, 136], [74, 136]] },
  { block: 2, lot: 3,  boundary: [[145, 96], [216, 96], [216, 136], [145, 136]] },
  { block: 2, lot: 4,  boundary: [[4, 136], [74, 136], [74, 176], [4, 176]] },
  { block: 2, lot: 5,  boundary: [[74, 136], [145, 136], [145, 176], [74, 176]] },
  { block: 2, lot: 6,  boundary: [[145, 136], [216, 136], [216, 176], [145, 176]] },
];

const SITES: SiteSeed[] = [
  {
    name: "Lui Pro",
    namePrefix: "Lui Pro",
    description: "Sample data — replace once the real Lui Pro plan is traced.",
    boundary: LUI_PRO_BOUNDARY,
    pricePerSqm: 1000,
    subdivisions: LUI_PRO_SUBDIVISIONS,
    lots: [
      { block: 1, lot: 1, status: "Sold" },
      { block: 1, lot: 3, status: "Reserved" },
      { block: 2, lot: 2, status: "Open" },
    ],
  },
  {
    name: "San Vicente 3",
    namePrefix: "San Vicente",
    description: "Sample data — replace once the real San Vicente 3 plan is traced.",
    boundary: SAN_VICENTE_BOUNDARY,
    pricePerSqm: 1500,
    subdivisions: SAN_VICENTE_SUBDIVISIONS,
    lots: [
      { block: 1, lot: 2, status: "Sold" },
      { block: 2, lot: 1, status: "Reserved" },
      { block: 2, lot: 3, status: "Open" },
    ],
  },
  {
    name: "Murillo Old",
    namePrefix: "Murillo",
    description: "Sample data — replace once the real Murillo Old plan is traced.",
    boundary: MURILLO_BOUNDARY,
    pricePerSqm: 2000,
    subdivisions: MURILLO_SUBDIVISIONS,
    lots: [
      { block: 1, lot: 2, status: "Sold" },
      { block: 2, lot: 1, status: "Reserved" },
      { block: 2, lot: 4, status: "Open" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

async function clearSite(siteSeed: SiteSeed): Promise<void> {
  const { data: sites, error: findError } = await supabase
    .from("site")
    .select("site_id, name")
    .like("name", `${siteSeed.namePrefix}%`)
    .returns<{ site_id: string; name: string }[]>();

  if (findError) {
    console.error(`❌  Failed to look up "${siteSeed.namePrefix}": ${findError.message}`);
    process.exit(1);
  }

  if (!sites || sites.length === 0) {
    console.log(`ℹ️   No site matching "${siteSeed.namePrefix}*" — nothing to remove.`);
    return;
  }

  for (const site of sites) {
    await supabase.from("property_lot").delete().eq("site_id", site.site_id);
    await supabase.from("site_subdivision").delete().eq("site_id", site.site_id);
    const { error } = await supabase.from("site").delete().eq("site_id", site.site_id);
    if (error) {
      console.error(`❌  Failed to delete site "${site.name}": ${error.message}`);
      process.exit(1);
    }
    console.log(`✅  Removed "${site.name}" and all its data.`);
  }
}

// ---------------------------------------------------------------------------
// Seed one site
// ---------------------------------------------------------------------------

async function seedSite(seed: SiteSeed): Promise<void> {
  const { data: site, error: siteError } = await supabase
    .from("site")
    .upsert({ name: seed.name, description: seed.description, boundary: seed.boundary }, { onConflict: "name" })
    .select("site_id, name")
    .single<{ site_id: string; name: string }>();

  if (siteError || !site) {
    console.error(`❌  Failed to upsert "${seed.name}": ${siteError?.message ?? "unknown"}`);
    process.exit(1);
  }
  console.log(`✅  Site: ${site.name}`);

  // Clear and re-insert subdivisions so re-runs don't stack duplicates.
  await supabase.from("site_subdivision").delete().eq("site_id", site.site_id);
  await supabase.from("property_lot").delete().eq("site_id", site.site_id);

  const subdivisionRows = seed.subdivisions.map((s) => ({
    site_id: site.site_id,
    block_number: s.block,
    lot_number: s.lot,
    boundary: s.boundary,
  }));

  const { error: subError } = await supabase.from("site_subdivision").insert(subdivisionRows);
  if (subError) {
    console.error(`❌  Failed to insert subdivisions for "${seed.name}": ${subError.message}`);
    process.exit(1);
  }
  console.log(`   ↳ ${subdivisionRows.length} subdivisions`);

  const subdivisionMap = new Map(
    seed.subdivisions.map((s) => [`${s.block}-${s.lot}`, s.boundary])
  );

  const lotRows = seed.lots.map((l) => {
    const boundary = subdivisionMap.get(`${l.block}-${l.lot}`)!;
    return {
      site_id: site.site_id,
      location: seed.name,
      block_number: l.block,
      lot_number: l.lot,
      area_size: Number(ringArea(boundary).toFixed(2)),
      price_per_sqm: seed.pricePerSqm,
      status: l.status,
    };
  });

  const { error: lotError } = await supabase.from("property_lot").insert(lotRows);
  if (lotError) {
    console.error(`❌  Failed to insert lots for "${seed.name}": ${lotError.message}`);
    process.exit(1);
  }
  const total = lotRows.reduce((sum, r) => sum + r.area_size, 0);
  console.log(`   ↳ ${lotRows.length} property lots (${total.toLocaleString()} sqm total, ₱${seed.pricePerSqm.toLocaleString()}/sqm)`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  if (process.argv.includes("--clear")) {
    for (const site of SITES) await clearSite(site);
    return;
  }

  for (const site of SITES) await seedSite(site);
  console.log("\nOpen /dashboard/properties/map to view the plans.");
}

main().catch((error) => {
  console.error("❌  Unexpected error:", error);
  process.exit(1);
});
