/**
 * scripts/seed-dev.ts
 *
 * Full development seed script:
 * 1. Seeds the baseline superadmin user and system_admin role.
 * 2. Seeds sample development sites and property subdivisions.
 *
 * Usage:
 *   npm run seed:dev
 *   (or: npx tsx --env-file=.env.local scripts/seed-dev.ts)
 */

import { seedBaseline } from "./seed-baseline";
import { seedAllSampleSites } from "./seed-sample-site";

async function main() {
  console.log("🚀 Starting full development database seed...\n");

  console.log("--- Step 1: Baseline Seed ---");
  await seedBaseline();

  console.log("--- Step 2: Sample Sites & Properties Seed ---");
  await seedAllSampleSites();

  console.log("\n✨  Development seeding complete! You can log in with the admin credentials and view sites at /dashboard/properties/map.\n");
}

if (process.argv[1]?.includes("seed-dev")) {
  main().catch((err: unknown) => {
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error("❌ Unexpected error during dev seed:", err);
    }
    process.exit(1);
  });
}

