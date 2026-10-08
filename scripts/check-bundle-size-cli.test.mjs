import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { runCheck } from "./check-bundle-size.mjs";
import { incompressible, makeStandardDist, removeCreatedFolders } from "./bundle-test-support.mjs";

afterEach(removeCreatedFolders);

function run(dist, budgetKb, env) {
  const out = [];
  const err = [];
  const code = runCheck({
    distDir: dist,
    budgetKb,
    env,
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
  });
  return { code, out: out.join(""), err: err.join("") };
}

test("exits 0 and prints the table when under the budget", () => {
  const { dist } = makeStandardDist();

  const { code, out } = run(dist, 300, {});

  assert.equal(code, 0);
  assert.match(out, /Total gzip/);
  assert.match(out, /assets\/app\.js/);
});

test("exits 1 with a clear message when over the budget", () => {
  const { dist } = makeStandardDist({ "assets/app.js": incompressible(20) });

  const { code, err } = run(dist, 10, {});

  assert.equal(code, 1);
  assert.match(err, /exceeds the budget of 10 KB/);
});

test("exits 1 when nothing can be measured", () => {
  const { root } = makeStandardDist();

  const { code, err } = run(join(root, "nowhere"), 300, {});

  assert.equal(code, 1);
  assert.match(err, /index\.html/);
});

test("writes the markdown summary only when GITHUB_STEP_SUMMARY is set", () => {
  const { root, dist } = makeStandardDist();
  const summary = join(root, "summary.md");

  run(dist, 300, {});
  assert.deepEqual(readdirSync(root), ["dist"]);

  run(dist, 300, { GITHUB_STEP_SUMMARY: summary });
  const text = readFileSync(summary, "utf8");
  assert.match(text, /\| File \| Raw \(KB\) \| Gzip \(KB\) \|/);
  assert.match(text, /Budget: 300 KB/);
  assert.match(text, /Margin/);
});

test("writes no summary when GITHUB_STEP_SUMMARY is empty", () => {
  const { root, dist } = makeStandardDist();

  const { code } = run(dist, 300, { GITHUB_STEP_SUMMARY: "" });

  assert.equal(code, 0);
  assert.deepEqual(readdirSync(root), ["dist"]);
});

test("the summary states the result and the total, for a pass and for a failure", () => {
  const { root, dist } = makeStandardDist();
  const summary = join(root, "summary.md");

  run(dist, 300, { GITHUB_STEP_SUMMARY: summary });
  run(join(root, "nowhere"), 300, { GITHUB_STEP_SUMMARY: summary });

  const text = readFileSync(summary, "utf8");
  assert.match(text, /Result: within budget\./);
  assert.match(text, /\| \*\*Total\*\* \| \| \*\*\d+\.\d\*\* \|/);
  assert.match(text, /Result: FAILED\./);
});

test("appends to an existing summary and still writes it when over the budget", () => {
  const { root, dist } = makeStandardDist({ "assets/app.js": incompressible(20) });
  const summary = join(root, "summary.md");
  appendFileSync(summary, "previous step\n");

  const { code } = run(dist, 10, { GITHUB_STEP_SUMMARY: summary });

  assert.equal(code, 1);
  const text = readFileSync(summary, "utf8");
  assert.ok(text.startsWith("previous step\n"));
  assert.match(text, /exceeds/i);
});

test("keeps the verdict when the summary cannot be written", () => {
  const { root, dist } = makeStandardDist({ "assets/app.js": incompressible(20) });

  const { code, err } = run(dist, 10, {
    GITHUB_STEP_SUMMARY: join(root, "no-folder", "summary.md"),
  });

  assert.equal(code, 1);
  assert.match(err, /exceeds the budget/);
  assert.match(err, /summary could not be written/);
});

test("the command line exits 1 on a missing build and 0 on a good one, using stdout and stderr", () => {
  const { dist, root } = makeStandardDist();
  const script = join(import.meta.dirname, "check-bundle-size.mjs");

  const good = spawnSync(process.execPath, [script, dist], { encoding: "utf8" });
  const bad = spawnSync(process.execPath, [script, join(root, "nowhere")], { encoding: "utf8" });

  assert.equal(good.status, 0);
  assert.match(good.stdout, /Total gzip/);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /not found/);
});
