import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Load test environment file based on TEST_ENV flag (defaults to remote managed .env.test)
const envFile = process.env.TEST_ENV === "local" ? ".env.test.local" : ".env.test";
const envPath = path.resolve(__dirname, envFile);

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
}

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "server-only": path.resolve(__dirname, "./scripts/tests/framework/empty-server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./scripts/tests/framework/vitest.setup.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
    maxConcurrency: 1,
    include: ["scripts/tests/**/*.test.ts"],
  },
});

