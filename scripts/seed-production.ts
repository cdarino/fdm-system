/**
 * scripts/seed-production.ts
 *
 * Development-only command script that seeds the baseline superadmin and roles
 * against the production Supabase database.
 *
 * Designed to be executed after pulling production env from Vercel:
 *   npx vercel env pull .env.production.local --environment=production --yes && npx tsx --env-file=.env.production.local scripts/seed-production.ts
 *
 * Credentials strategy:
 * - NEXT_PUBLIC_SUPABASE_URL and ADMIN_EMAIL are pulled from Vercel config via .env.production.local.
 * - Production secrets (SUPABASE_SECRET_KEY, ADMIN_PASSWORD) cannot be pulled via Vercel CLI once set as Secret.
 *   These are read from dedicated keys in .env.local (PROD_SUPABASE_SECRET_KEY, PROD_ADMIN_PASSWORD)
 *   or prompted interactively if not set.
 *
 * Safeguards:
 * - Exits if run inside automated CI/build environments (`process.env.CI === '1'`).
 * - Prompts for explicit interactive confirmation ("yes") unless bypassed with `--yes` or `-y`.
 * - Automatically cleans up temporary .env.production.local after execution (or on exit/interrupt).
 */

import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { seedBaseline } from "./seed-baseline";

const PROD_ENV_FILE = path.resolve(process.cwd(), ".env.production.local");
const LOCAL_ENV_FILE = path.resolve(process.cwd(), ".env.local");

function cleanupProdEnvFile() {
  if (process.argv.includes("--keep-env")) return;
  try {
    if (fs.existsSync(PROD_ENV_FILE)) {
      fs.unlinkSync(PROD_ENV_FILE);
      console.log("🧹  Cleaned up temporary .env.production.local file.");
    }
  } catch {
    // Ignore cleanup error if already removed
  }
}

// Ensure cleanup on sudden process exits or interrupts
process.on("SIGINT", () => {
  cleanupProdEnvFile();
  process.exit(130);
});

process.on("SIGTERM", () => {
  cleanupProdEnvFile();
  process.exit(143);
});

function loadEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath);
  return dotenv.parse(content);
}

function createPromptHelper() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const iterator = rl[Symbol.asyncIterator]();

  return {
    ask: async (question: string): Promise<string> => {
      process.stdout.write(question);
      const res = await iterator.next();
      return res.done ? "" : res.value.trim();
    },
    close: () => rl.close(),
  };
}

async function main() {
  const prompt = createPromptHelper();

  try {
    // 1. Guard against running in automated CI / cloud build environments
    if (process.env.CI === "1" || process.env.CI === "true") {
      console.error("❌  seed:production is a developer-only command and cannot run in CI or automated build environments.");
      process.exit(1);
    }

    // 2. Load configurations
    const prodEnv = loadEnv(PROD_ENV_FILE);
    const localEnv = loadEnv(LOCAL_ENV_FILE);

    // Target Supabase URL & Admin Email from Vercel config
    const supabaseUrl = prodEnv.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const adminEmail =
      prodEnv.ADMIN_EMAIL ??
      localEnv.PROD_ADMIN_EMAIL ??
      process.env.ADMIN_EMAIL ??
      "admin@example.com";

    if (!supabaseUrl) {
      console.error(
        "❌  Missing NEXT_PUBLIC_SUPABASE_URL from Vercel production environment.\n" +
        "    Make sure the Vercel project has NEXT_PUBLIC_SUPABASE_URL configured."
      );
      process.exit(1);
    }

    // 3. Resolve Production Secret Key: .env.local -> prompt
    let serviceRoleKey =
      localEnv.PROD_SUPABASE_SECRET_KEY ||
      localEnv.PRODUCTION_SUPABASE_SECRET_KEY ||
      process.env.PROD_SUPABASE_SECRET_KEY ||
      process.env.PRODUCTION_SUPABASE_SECRET_KEY ||
      prodEnv.SUPABASE_SECRET_KEY;

    if (!serviceRoleKey) {
      console.log("ℹ️   PROD_SUPABASE_SECRET_KEY was not found in .env.local.");
      serviceRoleKey = await prompt.ask("🔑 Enter production SUPABASE_SECRET_KEY: ");
    }

    if (!serviceRoleKey) {
      console.error("❌  Production SUPABASE_SECRET_KEY is required to seed the database.");
      process.exit(1);
    }

    // 4. Resolve Production Admin Password: .env.local -> prompt
    let adminPassword =
      localEnv.PROD_ADMIN_PASSWORD ||
      localEnv.PRODUCTION_ADMIN_PASSWORD ||
      process.env.PROD_ADMIN_PASSWORD ||
      process.env.PRODUCTION_ADMIN_PASSWORD ||
      prodEnv.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.log("ℹ️   PROD_ADMIN_PASSWORD was not found in .env.local.");
      adminPassword = await prompt.ask("🔒 Enter production ADMIN_PASSWORD: ");
    }

    if (!adminPassword) {
      console.error("❌  Production ADMIN_PASSWORD is required.");
      process.exit(1);
    }

    // 5. Interactive confirmation prompt
    const hasBypassFlag = process.argv.includes("--yes") || process.argv.includes("-y");

    console.log("=================================================================");
    console.log("⚠️   ATTENTION: TARGETING PRODUCTION DATABASE");
    console.log("=================================================================");
    console.log(` Target Supabase URL : ${supabaseUrl}`);
    console.log(` Baseline Superadmin : ${adminEmail}`);
    console.log("=================================================================");

    if (!hasBypassFlag) {
      const answer = await prompt.ask('Type "yes" to proceed with production baseline seeding: ');
      if (answer.toLowerCase() !== "yes") {
        console.log("\n🛑  Aborted. Production database was not modified.\n");
        return;
      }
    } else {
      console.log("⚡  Bypass flag detected (--yes). Proceeding without prompt...");
    }

    // 6. Execute baseline seed
    try {
      await seedBaseline({
        supabaseUrl,
        serviceRoleKey,
        adminPassword,
        adminEmail,
      });
      console.log("🎉  Production baseline seeding completed successfully!\n");
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err.message);
      } else {
        console.error("❌  Unexpected error during production seeding:", err);
      }
      process.exit(1);
    }
  } finally {
    prompt.close();
    cleanupProdEnvFile();
  }
}

if (process.argv[1]?.includes("seed-production")) {
  main();
}
