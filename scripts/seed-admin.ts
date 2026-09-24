/**
 * scripts/seed-admin.ts
 *
 * Backward-compatible entrypoint for baseline admin seeding.
 * Delegates directly to seedBaseline() in scripts/seed-baseline.ts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-admin.ts
 */

import { seedBaseline } from "./seed-baseline";

async function main() {
  try {
    await seedBaseline();
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error("❌  Unexpected error:", err);
    }
    process.exit(1);
  }
}

if (process.argv[1]?.includes("seed-admin")) {
  main();
}

export { seedBaseline };
