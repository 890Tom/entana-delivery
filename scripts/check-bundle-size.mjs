// Fails when the initial download of the client is larger than the budget, and prints the sizes.
// The initial set is what the browser needs before the first screen: index.html itself and every
// script, stylesheet and modulepreload file it references. A chunk loaded by a dynamic import is
// not in the HTML, so it never counts. The script only reads files under dist/ and runs nothing.
import { appendFileSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

// The written front-end rule: the initial download stays under 300 KB gzip. Changing this number
// changes the rule, so it is a decision for a pull request, not a tweak.
export const INITIAL_BUDGET_KB_GZIP = 300;

const BYTES_PER_KB = 1024;
const DEFAULT_DIST_DIR = resolve(import.meta.dirname, "../apps/client/dist");
const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);
const WHITESPACE = /\s/;
// A reference comes from the HTML: it is shown quoted and cut, never raw, so that it cannot add
// lines or markup to the log or to the job summary.
function quote(text) {
  const shown = text.length > 120 ? `${text.slice(0, 120)}...` : text;
  return JSON.stringify(shown);
}

function escapeCell(text) {
  return text.replace(/[|`<>\r\n]/g, "_");
}

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function skipWhile(text, start, isSkipped) {
  let index = start;
  while (index < text.length && isSkipped(text.charAt(index))) {
    index += 1;
  }
  return index;
}

function readAttributeValue(html, start) {
  const first = html.charAt(start);
  if (first === '"' || first === "'") {
    const close = html.indexOf(first, start + 1);
    const end = close === -1 ? html.length : close;
    return { value: html.slice(start + 1, end), next: Math.min(end + 1, html.length) };
  }
  const end = skipWhile(html, start, (char) => !WHITESPACE.test(char) && char !== ">");
  return { value: html.slice(start, end), next: end };
}

function readAttribute(html, start) {
  const nameEnd = skipWhile(html, start, (char) => !WHITESPACE.test(char) && !"=/>".includes(char));
  const name = html.slice(start, nameEnd).toLowerCase();
  const equals = skipWhile(html, nameEnd, (char) => WHITESPACE.test(char));
  if (html.charAt(equals) !== "=") {
    return { name, value: "", next: equals };
  }
  const { value, next } = readAttributeValue(
    html,
    skipWhile(html, equals + 1, (char) => WHITESPACE.test(char)),
  );
  return { name, value, next };
}

// Quotes are honoured (a ">" inside a value does not end the tag) and, like in a browser, the
// first of two identical attributes wins.
function readTag(html, start) {
  const nameEnd = skipWhile(
    html,
    start + 1,
    (char) => !WHITESPACE.test(char) && !"/>".includes(char),
  );
  const attributes = new Map();
  let index = nameEnd;
  while (index < html.length && html.charAt(index) !== ">") {
    if (WHITESPACE.test(html.charAt(index)) || html.charAt(index) === "/") {
      index += 1;
    } else {
      const attribute = readAttribute(html, index);
      attributes.set(attribute.name, attributes.get(attribute.name) ?? attribute.value);
      index = attribute.next;
    }
  }
  return {
    name: html.slice(start + 1, nameEnd).toLowerCase(),
    attributes,
    end: Math.min(index + 1, html.length),
  };
}

// The content of <script> and similar elements is raw text: a "<" or "<!--" in it is not markup.
function skipRawText(html, start, name) {
  const found = html.slice(start).search(new RegExp(`</${name}`, "i"));
  return found === -1 ? html.length : start + found;
}

function scanTags(html) {
  const tags = [];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf("<", index);
    if (open === -1) {
      break;
    }
    if (html.startsWith("<!--", open)) {
      const close = html.indexOf("-->", open + 4);
      index = close === -1 ? html.length : close + 3;
    } else if (/[a-z]/i.test(html.charAt(open + 1))) {
      const tag = readTag(html, open);
      tags.push(tag);
      index = RAW_TEXT_ELEMENTS.has(tag.name) ? skipRawText(html, tag.end, tag.name) : tag.end;
    } else {
      index = open + 1;
    }
  }
  return tags;
}

function isInitialLink(attributes) {
  const rels = (attributes.get("rel") ?? "").toLowerCase().split(/\s+/);
  return attributes.has("href") && (rels.includes("stylesheet") || rels.includes("modulepreload"));
}

/** The scripts, stylesheets and modulepreload files that index.html references, in order. */
export function extractReferences(html) {
  const references = [];
  for (const { name, attributes } of scanTags(html)) {
    if (name === "script" && attributes.has("src")) {
      references.push({ kind: "script", reference: attributes.get("src") ?? "" });
    } else if (name === "link" && isInitialLink(attributes)) {
      references.push({ kind: "link", reference: attributes.get("href") ?? "" });
    }
  }
  return references;
}

// Decided on the text alone, before the file system is touched: nothing outside dist/ is reached.
function unsafeReason(reference) {
  const path = reference.split(/[?#]/)[0] ?? "";
  if (URL_SCHEME.test(path) || path.startsWith("//")) {
    return "an absolute URL";
  }
  if (path.includes("\\") || path.includes("\0")) {
    return "a backslash or a null character";
  }
  return path.split("/").includes("..") ? "a path that leaves dist/" : undefined;
}

function toDistPath(distDir, reference) {
  const path = (reference.split(/[?#]/)[0] ?? "").replace(/^\/+/, "");
  return resolve(distDir, path);
}

function isInside(folder, file) {
  const path = relative(folder, file);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

// Returns the real path of a file inside dist/, or the reason it cannot be used.
function locateFile(distDir, realDistDir, reference) {
  const reason = unsafeReason(reference);
  if (reason !== undefined) {
    return { error: `Unsafe reference ${quote(reference)} (${reason}): not read.` };
  }
  let realPath;
  try {
    realPath = realpathSync(toDistPath(distDir, reference));
  } catch {
    return { error: `Referenced file ${quote(reference)} is missing from dist/.` };
  }
  if (!isInside(realDistDir, realPath)) {
    return { error: `Unsafe reference ${quote(reference)} (resolves outside dist/): not read.` };
  }
  return statSync(realPath).isFile()
    ? { realPath }
    : { error: `Referenced path ${quote(reference)} is not a file.` };
}

function measureFile(name, content) {
  return { file: name, rawBytes: content.length, gzipBytes: gzipSync(content).length };
}

function buildResult(rows, errors, budgetKb) {
  const totalGzipBytes = rows.reduce((sum, row) => sum + row.gzipBytes, 0);
  return {
    rows,
    errors,
    totalGzipBytes,
    budgetKb,
    isWithinBudget: errors.length === 0 && totalGzipBytes <= budgetKb * BYTES_PER_KB,
  };
}

function collectRows({ distDir, realDistDir, references, readFile }) {
  const rows = [];
  const errors = [];
  const seen = new Set();
  for (const { reference } of references) {
    const located = locateFile(distDir, realDistDir, reference);
    if (located.error !== undefined) {
      errors.push(located.error);
    } else if (!seen.has(located.realPath)) {
      seen.add(located.realPath);
      const name = relative(realDistDir, located.realPath).split(sep).join("/");
      rows.push(measureFile(name, readFile(located.realPath)));
    }
  }
  return { rows, errors };
}

/** Measures the initial set of `distDir`. Never throws: problems are returned in `errors`. */
export function measureInitialSet({ distDir, budgetKb, readFile = readFileSync }) {
  let html;
  try {
    html = readFile(join(distDir, "index.html"));
  } catch {
    return buildResult(
      [],
      [`${join(distDir, "index.html")} not found: build the client first.`],
      budgetKb,
    );
  }
  const references = extractReferences(html.toString("utf8"));
  if (!references.some(({ kind }) => kind === "script")) {
    return buildResult([], ["No <script src> found in index.html: nothing to measure."], budgetKb);
  }
  const collected = collectRows({
    distDir,
    realDistDir: realpathSync(distDir),
    references,
    readFile,
  });
  return buildResult(
    [measureFile("index.html", html), ...collected.rows],
    collected.errors,
    budgetKb,
  );
}

function kb(bytes) {
  return (bytes / BYTES_PER_KB).toFixed(1);
}

function totalLine(result) {
  const margin = result.budgetKb - result.totalGzipBytes / BYTES_PER_KB;
  return `Total gzip: ${kb(result.totalGzipBytes)} KB (budget ${String(result.budgetKb)} KB, margin ${margin.toFixed(1)} KB)`;
}

function formatText(result) {
  const width = Math.max(4, ...result.rows.map((row) => row.file.length));
  const lines = result.rows.map(
    (row) =>
      `${row.file.padEnd(width)}  ${kb(row.rawBytes).padStart(9)}  ${kb(row.gzipBytes).padStart(9)}`,
  );
  const header = `${"File".padEnd(width)}  ${"Raw (KB)".padStart(9)}  ${"Gzip (KB)".padStart(9)}`;
  return [header, ...lines, totalLine(result), ""].join("\n");
}

function formatMarkdown(result, failure) {
  const rows = result.rows.map(
    (row) => `| ${escapeCell(row.file)} | ${kb(row.rawBytes)} | ${kb(row.gzipBytes)} |`,
  );
  const margin = result.budgetKb - result.totalGzipBytes / BYTES_PER_KB;
  return [
    "### Client initial download",
    "",
    "| File | Raw (KB) | Gzip (KB) |",
    "| --- | ---: | ---: |",
    ...rows,
    `| **Total** | | **${kb(result.totalGzipBytes)}** |`,
    "",
    `Budget: ${String(result.budgetKb)} KB gzip. Margin: ${margin.toFixed(1)} KB.`,
    failure === undefined ? "Result: within budget." : `Result: FAILED. ${failure}`,
    "",
  ].join("\n");
}

function describeFailure(result) {
  if (result.errors.length > 0) {
    return result.errors.join("\n");
  }
  const over = result.totalGzipBytes / BYTES_PER_KB - result.budgetKb;
  return over > 0
    ? `The initial download (${kb(result.totalGzipBytes)} KB gzip) exceeds the budget of ${String(result.budgetKb)} KB by ${over.toFixed(1)} KB.`
    : undefined;
}

/** Prints the table, appends the markdown summary when asked, and returns the exit code. */
export function runCheck({ distDir, budgetKb, env, stdout, stderr }) {
  const result = measureInitialSet({ distDir, budgetKb });
  const failure = describeFailure(result);
  stdout(formatText(result));
  if (failure !== undefined) {
    stderr(`${failure}\n`);
  }
  const summaryPath = env.GITHUB_STEP_SUMMARY;
  if (summaryPath !== undefined && summaryPath !== "") {
    try {
      appendFileSync(summaryPath, formatMarkdown(result, failure));
    } catch {
      stderr("Warning: the job summary could not be written.\n");
    }
  }
  return failure === undefined ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runCheck({
    distDir: process.argv[2] === undefined ? DEFAULT_DIST_DIR : resolve(process.argv[2]),
    budgetKb: INITIAL_BUDGET_KB_GZIP,
    env: process.env,
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
