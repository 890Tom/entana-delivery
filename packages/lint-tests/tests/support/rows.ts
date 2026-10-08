import { INJECTION_ROWS } from "./injection-rows";
import { OTHER_ROWS } from "./other-rows";
import type { LintRow } from "./fixture-rows";

export const ROWS: readonly LintRow[] = [...INJECTION_ROWS, ...OTHER_ROWS];
