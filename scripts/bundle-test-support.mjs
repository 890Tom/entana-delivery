// Helpers shared by the tests of check-bundle-size.mjs: temporary dist/ folders and fixtures.
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { INITIAL_BUDGET_KB_GZIP, measureInitialSet } from "./check-bundle-size.mjs";

const createdFolders = [];

export const HTML = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/app.js"></script>
<link rel="stylesheet" crossorigin href="/assets/app.css">
</head><body><div id="root"></div></body></html>`;

/** Call from `afterEach`: removes every temporary folder made by `makeDist`. */
export function removeCreatedFolders() {
  for (const folder of createdFolders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
}

// Random bytes do not compress, so the gzip size is close to the number of bytes written.
export function incompressible(kilobytes) {
  return randomBytes(kilobytes * 1024);
}

/** A temporary `<root>/dist` with the given files (names relative to dist). */
export function makeDist(files) {
  const root = mkdtempSync(join(tmpdir(), "bundle-check-"));
  createdFolders.push(root);
  const dist = join(root, "dist");
  mkdirSync(join(dist, "assets"), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dist, name), content);
  }
  return { root, dist };
}

/** A dist with the standard index.html, a small script and a small stylesheet, plus extras. */
export function makeStandardDist(extra = {}) {
  return makeDist({ "index.html": HTML, "assets/app.js": "a", "assets/app.css": "b", ...extra });
}

export function measure(dist, budgetKb = INITIAL_BUDGET_KB_GZIP, readFile) {
  return measureInitialSet({ distDir: dist, budgetKb, readFile });
}
