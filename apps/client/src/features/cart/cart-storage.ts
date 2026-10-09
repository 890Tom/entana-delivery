import { MAX_ORDER_LINES, MAX_ORDER_LINE_QUANTITY } from "@entana/contracts";
import type { CartLine } from "./cart-reducer";

export const CART_STORAGE_KEY = "entana.cart.v1";
const STORAGE_VERSION = 1;
// 30 lines take about 2 KB: anything near this size was not written by this application.
const MAX_STORED_LENGTH = 8192;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

function parseLine(value: unknown): CartLine | undefined {
  if (!isRecord(value) || !hasExactKeys(value, ["productId", "quantity"])) {
    return undefined;
  }
  const { productId, quantity } = value;
  const isValid =
    typeof productId === "string" &&
    UUID.test(productId) &&
    typeof quantity === "number" &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= MAX_ORDER_LINE_QUANTITY;
  return isValid ? { productId, quantity } : undefined;
}

function parseLines(value: unknown): readonly CartLine[] {
  if (!Array.isArray(value) || value.length > MAX_ORDER_LINES) {
    return [];
  }
  const lines = value.map(parseLine);
  const valid = lines.filter((line): line is CartLine => line !== undefined);
  const isDuplicated =
    new Set(valid.map((line) => line.productId.toLowerCase())).size !== valid.length;
  return valid.length === lines.length && !isDuplicated ? valid : [];
}

/** The stored text is untrusted: bounded, strictly validated, and empty at the first doubt. */
function parseStoredCart(stored: string | null): readonly CartLine[] {
  if (stored === null || stored.length > MAX_STORED_LENGTH) {
    return [];
  }
  let content: unknown;
  try {
    content = JSON.parse(stored);
  } catch {
    return [];
  }
  if (!isRecord(content) || !hasExactKeys(content, ["version", "lines"])) {
    return [];
  }
  const { version, lines } = content;
  return version === STORAGE_VERSION ? parseLines(lines) : [];
}

export function serializeCart(lines: readonly CartLine[]): string {
  return JSON.stringify({ version: STORAGE_VERSION, lines });
}

/** Private browsing or a blocked storage makes even reaching `localStorage` throw. */
export function readStoredCart(): readonly CartLine[] {
  try {
    return parseStoredCart(window.localStorage.getItem(CART_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeStoredCart(lines: readonly CartLine[]): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(lines));
  } catch {
    // Quota or private browsing: the cart goes on working in memory.
  }
}
