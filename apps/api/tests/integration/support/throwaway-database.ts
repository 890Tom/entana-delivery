import { randomBytes } from "node:crypto";

// The one pattern for a database this suite may create, drop or empty: `test_` and lowercase hex.
const THROWAWAY_DATABASE_PATTERN = /^test_[0-9a-f]+$/;
const NAME_RANDOM_BYTES = 8;

export function isThrowawayDatabaseName(name: string): boolean {
  return THROWAWAY_DATABASE_PATTERN.test(name);
}

export function generateThrowawayDatabaseName(): string {
  return `test_${randomBytes(NAME_RANDOM_BYTES).toString("hex")}`;
}
