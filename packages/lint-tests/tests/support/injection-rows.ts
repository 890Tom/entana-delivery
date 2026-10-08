import { CLIENT_TS, CLIENT_TSX, PROPERTIES, RENDER_TEXT, row, SYNTAX } from "./fixture-rows";
import type { LintRow } from "./fixture-rows";

const DANGEROUSLY = "dangerouslySetInnerHTML is forbidden";
const ASSIGNMENT = "Assigning innerHTML, outerHTML or srcdoc is forbidden";
const URL_RULE = "javascript:, data: and vbscript: URLs are forbidden";
const URL_ADVICE = "Use an https: or relative URL";

const dangerouslyRows: readonly LintRow[] = [
  row(
    "dangerouslySetInnerHTML as a JSX attribute",
    CLIENT_TSX,
    'export const a = <div dangerouslySetInnerHTML={{ __html: "x" }} />;',
    {
      ruleId: SYNTAX,
      at: "dangerouslySetInnerHTML",
      messageFragment: RENDER_TEXT,
      covers: DANGEROUSLY,
    },
  ),
  row(
    "dangerouslySetInnerHTML as an object key in a .ts file",
    CLIENT_TS,
    'export const props = { dangerouslySetInnerHTML: { __html: "x" } };',
    {
      ruleId: SYNTAX,
      at: "dangerouslySetInnerHTML",
      messageFragment: RENDER_TEXT,
      covers: DANGEROUSLY,
    },
  ),
  row(
    "dangerouslySetInnerHTML in createElement props",
    CLIENT_TS,
    'export const a = createElement("div", { dangerouslySetInnerHTML: { __html: "x" } });',
    {
      ruleId: SYNTAX,
      at: "dangerouslySetInnerHTML",
      messageFragment: RENDER_TEXT,
      covers: DANGEROUSLY,
    },
  ),
  row(
    "dangerouslySetInnerHTML as a string key",
    CLIENT_TS,
    'export const props = { "dangerouslySetInnerHTML": { __html: "x" } };',
    {
      ruleId: SYNTAX,
      at: '"dangerouslySetInnerHTML"',
      messageFragment: RENDER_TEXT,
      covers: DANGEROUSLY,
    },
  ),
];

const assignmentRows: readonly LintRow[] = ["innerHTML", "outerHTML", "srcdoc"].flatMap((name) => [
  row(`${name} assignment, dot form`, CLIENT_TS, `export function f(el, v) { el.${name} = v; }`, {
    ruleId: SYNTAX,
    at: `el.${name}`,
    messageFragment: RENDER_TEXT,
    covers: ASSIGNMENT,
  }),
  row(
    `${name} assignment, bracket form`,
    CLIENT_TS,
    `export function f(el, v) { el["${name}"] = v; }`,
    {
      ruleId: SYNTAX,
      at: `el["${name}"]`,
      messageFragment: RENDER_TEXT,
      covers: ASSIGNMENT,
    },
  ),
]);

const documentRows: readonly LintRow[] = [
  row(
    "srcDoc as a JSX attribute",
    CLIENT_TSX,
    'export const a = <iframe title="t" srcDoc="x" />;',
    {
      ruleId: SYNTAX,
      at: "srcDoc",
      messageFragment: RENDER_TEXT,
      covers: "srcDoc is forbidden",
    },
  ),
  row("window.document.write", CLIENT_TS, "export function f(v) { window.document.write(v); }", {
    ruleId: SYNTAX,
    at: "window.document.write",
    messageFragment: RENDER_TEXT,
    covers: "window.document.write and writeln",
  }),
  row("document.write", CLIENT_TS, "export function f(v) { document.write(v); }", {
    ruleId: PROPERTIES,
    at: "document.write",
    messageFragment: RENDER_TEXT,
    covers: "document.write writes",
  }),
  row("document.writeln", CLIENT_TS, "export function f(v) { document.writeln(v); }", {
    ruleId: PROPERTIES,
    at: "document.writeln",
    messageFragment: RENDER_TEXT,
    covers: "document.writeln writes",
  }),
];

const parserRows: readonly LintRow[] = [
  ["insertAdjacentHTML", "el.insertAdjacentHTML('beforeend', v)"],
  ["createContextualFragment", "range.createContextualFragment(v)"],
  ["setHTMLUnsafe", "el.setHTMLUnsafe(v)"],
  ["parseHTMLUnsafe", "Document.parseHTMLUnsafe(v)"],
  ["setHTML", "popup.setHTML(v)"],
].map(([name = "", call = ""]) =>
  row(`${name} call`, CLIENT_TS, `export function f(el, v) { ${call}; }`, {
    ruleId: PROPERTIES,
    at: call,
    messageFragment: RENDER_TEXT,
    covers: `${name} parses`,
  }),
);

const urlRows: readonly LintRow[] = [
  row(
    "javascript: URL in href",
    CLIENT_TSX,
    'export const a = <a href="javascript:alert(1)">x</a>;',
    {
      ruleId: SYNTAX,
      at: '"javascript:alert(1)"',
      messageFragment: URL_ADVICE,
      covers: URL_RULE,
    },
  ),
  row("data: URL in src", CLIENT_TSX, 'export const a = <img alt="" src="data:text/html,x" />;', {
    ruleId: SYNTAX,
    at: '"data:text/html,x"',
    messageFragment: URL_ADVICE,
    covers: URL_RULE,
  }),
  row("vbscript: URL in action", CLIENT_TSX, 'export const a = <form action="vbscript:x" />;', {
    ruleId: SYNTAX,
    at: '"vbscript:x"',
    messageFragment: URL_ADVICE,
    covers: URL_RULE,
  }),
  row(
    "mixed-case javascript: URL in an expression",
    CLIENT_TSX,
    'export const a = <a href={"JavaScript:alert(1)"}>x</a>;',
    {
      ruleId: SYNTAX,
      at: '"JavaScript:alert(1)"',
      messageFragment: URL_ADVICE,
      covers: URL_RULE,
    },
  ),
  row(
    "javascript: URL in a template literal",
    CLIENT_TSX,
    "export const a = <form action={`javascript:alert(1)`} />;",
    {
      ruleId: SYNTAX,
      at: "`javascript:alert(1)`",
      messageFragment: URL_ADVICE,
      covers: URL_RULE,
    },
  ),
];

const moreUrlRows: readonly LintRow[] = [
  ["formAction", '<button formAction="javascript:x" />', '"javascript:x"'],
  ["xlinkHref", '<use xlinkHref="javascript:x" />', '"javascript:x"'],
  ["data", '<object data="data:text/html,x" />', '"data:text/html,x"'],
  ["an upper-case literal", '<a href="JAVASCRIPT:x">x</a>', '"JAVASCRIPT:x"'],
  ["a literal with leading whitespace", '<a href=" javascript:x">x</a>', '" javascript:x"'],
].map(([name = "", jsx = "", at = ""]) =>
  row(`dangerous URL in ${name}`, CLIENT_TSX, `export const a = ${jsx};`, {
    ruleId: SYNTAX,
    at,
    messageFragment: URL_ADVICE,
    covers: URL_RULE,
  }),
);

export const INJECTION_ROWS: readonly LintRow[] = [
  ...dangerouslyRows,
  ...assignmentRows,
  ...documentRows,
  ...parserRows,
  ...urlRows,
  ...moreUrlRows,
];
