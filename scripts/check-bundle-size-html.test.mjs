import assert from "node:assert/strict";
import { test } from "node:test";

import { extractReferences } from "./check-bundle-size.mjs";

const references = (html) => extractReferences(html).map((item) => item.reference);

test("finds scripts, stylesheets and modulepreload links, and nothing else", () => {
  const html = `<script>inline()</script><script src="/a.js"></script>
<link rel="stylesheet" href="/a.css"><link rel="modulepreload" href="/v.js">
<link rel="preload" href="/font.woff2"><link rel="icon" href="/i.png"><link rel="prefetch" href="/n.js">`;

  assert.deepEqual(references(html), ["/a.js", "/a.css", "/v.js"]);
});

test("counts a link whose rel holds several words, whatever the attribute order", () => {
  assert.deepEqual(references('<link href="/a.css" rel="Stylesheet preload">'), ["/a.css"]);
});

test("reads single-quoted, unquoted and upper-case tags", () => {
  const html = "<SCRIPT SRC='/a.js'></SCRIPT><link href=/a.css REL=stylesheet>";

  assert.deepEqual(references(html), ["/a.js", "/a.css"]);
});

test("does not stop a tag at a > inside a quoted attribute value", () => {
  assert.deepEqual(references('<script data-x=">" src="/big.js"></script>'), ["/big.js"]);
});

test("uses the first of two identical attributes, like a browser", () => {
  assert.deepEqual(references('<script src="/big.js" src="/small.js"></script>'), ["/big.js"]);
});

test("ignores an HTML comment", () => {
  assert.deepEqual(
    references('<!-- <script src="/old.js"></script> --><script src="/a.js"></script>'),
    ["/a.js"],
  );
});

test("does not treat <!-- inside inline script text as a comment", () => {
  const html = '<script>var a = "<!--";</script><script src="/a.js"></script><!-- real comment -->';

  assert.deepEqual(references(html), ["/a.js"]);
});

test("does not read a tag written inside a script's text", () => {
  assert.deepEqual(references('<script>var a = "<script src=/fake.js>";</script>'), []);
});

test("copes with broken markup without looping", () => {
  assert.deepEqual(references('<script src="/a.js'), ["/a.js"]);
  assert.deepEqual(references("<script src=/a.js <= < > <"), ["/a.js"]);
});
