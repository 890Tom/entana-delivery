import assert from "node:assert/strict";
import { readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { gzipSync } from "node:zlib";

import { INITIAL_BUDGET_KB_GZIP } from "./check-bundle-size.mjs";
import {
  HTML,
  incompressible,
  makeDist,
  makeStandardDist,
  measure,
  removeCreatedFolders,
} from "./bundle-test-support.mjs";

afterEach(removeCreatedFolders);

const STANDARD_FILES = ["index.html", "assets/app.js", "assets/app.css"];

test("the written front-end budget is 300 KB gzip", () => {
  assert.equal(INITIAL_BUDGET_KB_GZIP, 300);
});

test("passes when the initial set is under the budget", () => {
  const { dist } = makeStandardDist({ "assets/app.js": "a".repeat(5000) });

  const result = measure(dist);

  assert.deepEqual(result.errors, []);
  assert.equal(result.isWithinBudget, true);
  assert.deepEqual(
    result.rows.map((row) => row.file),
    STANDARD_FILES,
  );
});

test("fails when the total gzip size is over the budget", () => {
  const { dist } = makeStandardDist({ "assets/app.js": incompressible(20) });

  const result = measure(dist, 10);

  assert.equal(result.isWithinBudget, false);
  assert.ok(result.totalGzipBytes > 10 * 1024);
});

test("passes at exactly the budget and fails one byte over", () => {
  const { dist } = makeStandardDist({ "assets/app.js": incompressible(2) });
  const total = measure(dist).totalGzipBytes;

  assert.equal(measure(dist, total / 1024).isWithinBudget, true);
  assert.equal(measure(dist, (total - 1) / 1024).isWithinBudget, false);
});

test("adds the gzip size of every file to the total", () => {
  const { dist } = makeStandardDist({ "assets/app.js": "a".repeat(900) });

  const expected = STANDARD_FILES.reduce(
    (sum, name) => sum + gzipSync(readFileSync(join(dist, name))).length,
    0,
  );

  assert.equal(measure(dist).totalGzipBytes, expected);
});

test("does not count a lazy chunk that index.html does not reference", () => {
  const { dist } = makeStandardDist({ "assets/lazy-map.js": incompressible(50) });

  const result = measure(dist, 10);

  assert.equal(result.isWithinBudget, true);
  assert.deepEqual(
    result.rows.map((row) => row.file),
    STANDARD_FILES,
  );
});

test("never parses JavaScript: a dynamic import inside a script is not followed", () => {
  const { dist } = makeStandardDist({
    "assets/app.js": 'import("./lazy-map.js")',
    "assets/lazy-map.js": incompressible(20),
  });

  const result = measure(dist, 10);

  assert.equal(result.isWithinBudget, true);
  assert.deepEqual(
    result.rows.map((row) => row.file),
    STANDARD_FILES,
  );
});

test("counts a modulepreload file", () => {
  const html = HTML.replace(
    "</head>",
    '<link rel="modulepreload" href="/assets/vendor.js"></head>',
  );
  const { dist } = makeStandardDist({ "index.html": html, "assets/vendor.js": incompressible(20) });

  const result = measure(dist, 10);

  assert.ok(result.rows.some((row) => row.file === "assets/vendor.js"));
  assert.equal(result.isWithinBudget, false);
});

test("counts a file once when it is referenced twice", () => {
  const html = HTML.replace("</head>", '<link rel="modulepreload" href="/assets/app.js"></head>');
  const { dist } = makeStandardDist({ "index.html": html });

  const result = measure(dist);

  assert.deepEqual(
    result.rows.map((row) => row.file),
    STANDARD_FILES,
  );
});

test("resolves a query string, a fragment and a relative path", () => {
  const html =
    '<script src="./assets/app.js?v=1"></script><link rel="stylesheet" href="assets/app.css#x">';
  const { dist } = makeStandardDist({ "index.html": html });

  const result = measure(dist);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.rows.map((row) => row.file),
    STANDARD_FILES,
  );
});

test("a script hidden behind a > in an attribute value is still measured", () => {
  const html =
    '<script src="/assets/app.js"></script><script data-x=">" src="/assets/big.js"></script>';
  const { dist } = makeStandardDist({ "index.html": html, "assets/big.js": incompressible(20) });

  assert.equal(measure(dist, 10).isWithinBudget, false);
});

test("fails when index.html is missing or empty, or the folder does not exist", () => {
  const { dist, root } = makeDist({});

  assert.match(measure(dist).errors.join("\n"), /index\.html.*not found/);
  assert.match(measure(join(root, "nowhere")).errors.join("\n"), /not found/);
  writeFileSync(join(dist, "index.html"), "");
  assert.match(measure(dist).errors.join("\n"), /no <script src>/i);
});

test("fails when the HTML has no script", () => {
  const { dist } = makeDist({ "index.html": "<html><body>hello</body></html>" });

  assert.match(measure(dist).errors.join("\n"), /no <script src>/i);
});

test("fails when a referenced file is missing or is a directory", () => {
  const html = '<script src="/assets/gone.js"></script><script src="/assets/"></script>';
  const { dist } = makeDist({ "index.html": html });

  const errors = measure(dist).errors.join("\n");

  assert.match(errors, /gone\.js.*missing/);
  assert.match(errors, /not a file/);
});

test("reports every problem, and one bad reference fails the whole check", () => {
  const html =
    '<script src="/assets/app.js"></script><script src="../x.js"></script><script src="/gone.js"></script>';
  const { dist } = makeDist({ "index.html": html, "assets/app.js": "a" });

  const result = measure(dist);

  assert.equal(result.errors.length, 2);
  assert.equal(result.isWithinBudget, false);
});

const UNSAFE_REFERENCES = [
  ["a parent folder", "../secret.js"],
  ["a nested parent folder", "/assets/../../secret.js"],
  ["an https URL", "https://example.org/x.js"],
  ["an http URL", "http://example.org/x.js"],
  ["a protocol-relative URL", "//example.org/x.js"],
  ["a file URL", "file:///etc/passwd"],
  ["a data URL", "data:text/javascript,alert(1)"],
  ["a backslash path", "..\\secret.js"],
];

for (const [name, reference] of UNSAFE_REFERENCES) {
  test(`reports ${name} as an error and passes no outside path to readFile`, () => {
    const { root, dist } = makeDist({ "index.html": `<script src="${reference}"></script>` });
    writeFileSync(join(root, "secret.js"), "SECRET");
    const readPaths = [];

    const result = measure(dist, 300, (path) => {
      readPaths.push(path);
      return readFileSync(path);
    });

    assert.match(result.errors.join("\n"), /unsafe reference/i);
    assert.equal(result.isWithinBudget, false);
    assert.deepEqual(
      readPaths.filter((path) => !path.endsWith("index.html")),
      [],
    );
  });
}

test("rejects a symbolic link that leaves dist/", () => {
  const { root, dist } = makeStandardDist();
  writeFileSync(join(root, "outside.js"), "SECRET");
  symlinkSync(join(root, "outside.js"), join(dist, "assets/link.js"));
  writeFileSync(join(dist, "index.html"), '<script src="/assets/link.js"></script>');
  const readPaths = [];

  const result = measure(dist, 300, (path) => {
    readPaths.push(path);
    return readFileSync(path);
  });

  assert.match(result.errors.join("\n"), /unsafe reference/i);
  assert.equal(result.isWithinBudget, false);
  assert.ok(!readPaths.some((path) => path.endsWith("outside.js")));
});

test("shows a reference with a line break on one quoted line", () => {
  const { dist } = makeDist({ "index.html": '<script src="/gone.js\n::error::fake"></script>' });

  const errors = measure(dist).errors.join("\n");

  assert.equal(errors.split("\n").length, 1);
  assert.match(errors, /\\n::error::fake/);
});
