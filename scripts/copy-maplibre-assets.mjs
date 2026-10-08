// Copies the MapLibre worker and stylesheet into public/ so the map can load
// them at /maplibre/*. Runs on postinstall. Written in Node instead of shell
// commands because `mkdir -p` and `cp` do not exist in cmd.exe, which npm uses
// on Windows, and the failed script made `npm install` exit with an error.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = join("node_modules", "maplibre-gl", "dist");
const target = join("public", "maplibre");
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs", "maplibre-gl.css"];

mkdirSync(target, { recursive: true });
for (const file of files) {
  copyFileSync(join(source, file), join(target, file));
}
