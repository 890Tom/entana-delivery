import { CLIENT_TS, CLIENT_TSX, row, SYNTAX } from "./fixture-rows";
import type { LintRow } from "./fixture-rows";

// Rules of the client override that are not about HTML, and the shared entries it repeats.
export const OTHER_ROWS: readonly LintRow[] = [
  row("eval", CLIENT_TS, 'export const a = eval("1");', {
    ruleId: "no-eval",
    at: "eval",
    messageFragment: "eval",
  }),
  row("new Function", CLIENT_TS, 'export const a = new Function("return 1");', {
    ruleId: "no-new-func",
    at: "new Function",
    messageFragment: "Function constructor",
  }),
  row(
    "a hook called conditionally",
    CLIENT_TSX,
    "export function A({ v }) { if (v) { useState(0); } return null; }",
    {
      ruleId: "react-hooks/rules-of-hooks",
      at: "useState",
      messageFragment: "called conditionally",
    },
  ),
  row(
    "a missing hook dependency",
    CLIENT_TSX,
    "export function A({ v }) { useEffect(() => { log(v); }, []); return null; }",
    {
      ruleId: "react-hooks/exhaustive-deps",
      at: "[]",
      messageFragment: "missing dependency",
    },
  ),
  row("a default export (shared entry)", CLIENT_TS, "export default 1;", {
    ruleId: SYNTAX,
    at: "export default",
    messageFragment: "No default exports",
    covers: "No default exports",
  }),
  row(
    "a default export through an export specifier (shared entry)",
    CLIENT_TS,
    "const a = 1; export { a as default };",
    {
      ruleId: SYNTAX,
      at: "a as default",
      messageFragment: "No default exports",
      covers: "No default exports",
    },
  ),
  row(
    "a dynamic import of the database driver (shared entry)",
    CLIENT_TS,
    'export const a = import("pg");',
    {
      ruleId: SYNTAX,
      at: 'import("pg")',
      messageFragment: "Only packages/database",
      covers: "Only packages/database",
    },
  ),
];
