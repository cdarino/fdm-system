/**
 * scripts/seed-sample-site.ts
 *
 * Seeds one sample site with an irregular outline and the lots cut from it, so
 * the site map (Sprint 2 / r28) has real geometry to render before the
 * company's traced subdivision plan is available.
 *
 * This is DEVELOPMENT DATA, which is why it is a script rather than a
 * migration — migrations run against every environment including production.
 * Re-running it is safe: the site is matched by name and its lots are replaced.
 *
 * Usage:
 *   npm run seed:sample-site          seed (or re-seed) the sample site
 *   npm run seed:sample-site:clear    remove it and every lot on it
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

const SITE_NAME = "Sample Subdivision, Phase 1";

/**
 * Teardown matches on this prefix rather than on SITE_NAME exactly.
 *
 * Renaming the sample site used to strand the previous row: --clear looked for
 * the new name, found nothing, and the old site stayed in the database with no
 * obvious way to reach it. Matching the prefix removes every variant that has
 * ever been seeded from this script.
 */
const SITE_NAME_PREFIX = "Sample Subdivision";

/**
 * Local space is metres, origin top-left, Y growing DOWN to match SVG.
 *
 * The outline is deliberately NOT a rectangle: a real parcel has an angled
 * road frontage and a skewed rear boundary, and those are exactly the cases
 * that break a renderer which quietly assumes axis-aligned boxes.
 */
const SITE_BOUNDARY: [number, number][] = [
  [0, 20],
  [40, 0],
  [180, 0],
  [200, 30],
  [200, 130],
  [150, 150],
  [20, 150],
  [0, 110],
];

type LotSeed = {
  block: number;
  lot: number;
  boundary: [number, number][];
  status: "Open" | "Reserved" | "Sold" | "Forfeited";
};

/**
 * Two blocks split by a road corridor running across the middle. Lots share
 * edges exactly, the way a real plat does, so any gap or overlap in the
 * renderer shows up immediately.
 */
const LOTS: LotSeed[] = [
  // Block 1 — north strip, following the angled frontage.
  { block: 1, lot: 1, status: "Sold",      boundary: [[6, 22], [40, 6], [70, 6], [70, 62], [6, 62]] },
  { block: 1, lot: 2, status: "Open",      boundary: [[70, 6], [110, 6], [110, 62], [70, 62]] },
  { block: 1, lot: 3, status: "Reserved",  boundary: [[110, 6], [150, 6], [150, 62], [110, 62]] },
  { block: 1, lot: 4, status: "Open",      boundary: [[150, 6], [178, 6], [194, 30], [194, 62], [150, 62]] },

  // Block 2 — south strip, squared off against the rear boundary.
  { block: 2, lot: 1, status: "Open",      boundary: [[8, 86], [64, 86], [64, 144], [20, 144], [8, 112]] },
  { block: 2, lot: 2, status: "Forfeited", boundary: [[64, 86], [118, 86], [118, 144], [64, 144]] },
  { block: 2, lot: 3, status: "Sold",      boundary: [[118, 86], [170, 86], [170, 140], [118, 144]] },
  { block: 2, lot: 4, status: "Open",      boundary: [[170, 86], [194, 86], [194, 130], [170, 140]] },
];

/** Shoelace area, mirroring lib/geometry.ts so seeded area_size matches the shape. */
function ringArea(ring: [number, number][]): number {
  let twice = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice) / 2;
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Removes the sample site and its lots.
 *
 * Lots must go FIRST. property_lot.site_id is ON DELETE SET NULL, so dropping
 * the site on its own would not cascade — it would leave the sample lots behind
 * as orphans with a null site_id and their boundary still set, which then show
 * up in the lot list with no way to tell where they came from.
 */
async function clearSampleSite(): Promise<void> {
  const { data: sites, error: findError } = await supabase
    .from("site")
    .select("site_id, name")
    .like("name", `${SITE_NAME_PREFIX}%`)
    .returns<{ site_id: string; name: string }[]>();

  if (findError) {
    console.error(`❌  Failed to look up sites: ${findError.message}`);
    process.exit(1);
  }

  if (!sites || sites.length === 0) {
    console.log(`ℹ️   No site starting with "${SITE_NAME_PREFIX}" - nothing to remove.`);
    return;
  }

  for (const site of sites) {
    const { count, error: lotsError } = await supabase
      .from("property_lot")
      .delete({ count: "exact" })
      .eq("site_id", site.site_id);

    if (lotsError) {
      console.error(`❌  Failed to delete lots for "${site.name}": ${lotsError.message}`);
      process.exit(1);
    }

    const { error: siteError } = await supabase
      .from("site")
      .delete()
      .eq("site_id", site.site_id);

    if (siteError) {
      console.error(`❌  Failed to delete site "${site.name}": ${siteError.message}`);
      process.exit(1);
    }

    console.log(`✅  Removed ${count ?? 0} lot(s) and the site "${site.name}".`);
  }
}

async function main() {
  if (process.argv.includes("--clear")) {
    await clearSampleSite();
    return;
  }

  const { data: site, error: siteError } = await supabase
    .from("site")
    .upsert(
      {
        name: SITE_NAME,
        description: "Development sample, replace once the real plan is traced.",
        boundary: SITE_BOUNDARY,
      },
      { onConflict: "name" },
    )
    .select("site_id, name")
    .single<{ site_id: string; name: string }>();

  if (siteError || !site) {
    console.error(`❌  Failed to upsert site: ${siteError?.message ?? "unknown error"}`);
    process.exit(1);
  }
  console.log(`✅  Site ready: ${site.name}`);

  // Replace this site's lots so re-running does not stack duplicates. The
  // unique constraint is (location, block_number, lot_number), so a plain
  // upsert on site_id would not catch them.
  const { error: clearError } = await supabase
    .from("property_lot")
    .delete()
    .eq("site_id", site.site_id);

  if (clearError) {
    console.error(`❌  Failed to clear existing sample lots: ${clearError.message}`);
    process.exit(1);
  }

  const rows = LOTS.map((seed) => ({
    site_id: site.site_id,
    location: SITE_NAME,
    block_number: seed.block,
    lot_number: seed.lot,
    // Derived from the polygon, so the map's area check passes on seeded data
    // and only flags genuinely mis-drawn lots.
    area_size: Number(ringArea(seed.boundary).toFixed(2)),
    price_per_sqm: 3500,
    status: seed.status,
    boundary: seed.boundary,
  }));

  const { error: insertError } = await supabase.from("property_lot").insert(rows);
  if (insertError) {
    console.error(`❌  Failed to insert sample lots: ${insertError.message}`);
    process.exit(1);
  }

  const total = rows.reduce((sum, r) => sum + r.area_size, 0);
  console.log(`✅  Seeded ${rows.length} lots (${total.toLocaleString()} sqm total)`);
  console.log("   Open /dashboard/properties/map to view the plan.");
}

main().catch((error) => {
  console.error("❌  Unexpected error:", error);
  process.exit(1);
});
