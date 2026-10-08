export interface LintRow {
  readonly name: string;
  readonly code: string;
  readonly filePath: string;
  readonly ruleId: string;
  /** The text where the report must start: the first occurrence of it in `code`. */
  readonly at: string;
  /** What the message must say. For the injection rules: what to do instead. */
  readonly messageFragment: string;
  /** Start of the message of the configured entry (selector or property) this row exercises. */
  readonly covers?: string;
}

export const CLIENT_TS = "apps/client/src/fixture.ts";
export const CLIENT_TSX = "apps/client/src/fixture.tsx";

export const RENDER_TEXT = "Render text through React";
export const SYNTAX = "no-restricted-syntax";
export const PROPERTIES = "no-restricted-properties";

export function row(
  name: string,
  filePath: string,
  code: string,
  expected: Pick<LintRow, "ruleId" | "at" | "messageFragment" | "covers">,
): LintRow {
  return { name, filePath, code, ...expected };
}
