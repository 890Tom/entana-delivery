import type { Client } from "pg";

interface Scenario {
  name: string;
  run: (db: Client) => Promise<unknown>;
}

// Each case changes one thing from a valid row, so the constraint under test is the only
// one that can reject it.
export interface ConstraintCase {
  constraint: string;
  accepted: Scenario[];
  rejected: Scenario[];
}
