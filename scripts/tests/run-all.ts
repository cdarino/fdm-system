import { spawnSync } from "node:child_process";

// Forward execution to Vitest runner
const result = spawnSync("npx", ["vitest", "run", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 0);
