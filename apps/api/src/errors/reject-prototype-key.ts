import type { NextFunction, Request } from "express";
import { UnacceptableBodyError } from "./unacceptable-body-error.js";

/**
 * The walk gives up beyond these, so that a hostile body cannot use the stack or the CPU: the JSON
 * parser has already built the value, and this only reads it once, without recursion. A real body
 * of this API is a few levels deep and a few hundred nodes.
 */
export const MAX_BODY_DEPTH = 64;
export const MAX_BODY_NODES = 100_000;

// The three keys that the validation pipe of Nest deletes silently (stripProtoKeys), whatever the
// schema says: a strict schema would never see them, so a body that carries one would be accepted.
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"] as const;

export type BodyInspection = "ok" | "prototype-key" | "too-deep" | "too-large";

interface Pending {
  readonly value: unknown;
  readonly depth: number;
}

/**
 * Looks for an own `__proto__`, `constructor` or `prototype` key at any depth. JSON.parse keeps
 * such a key as an own property, and the validation pipe of Nest then removes it silently, so a
 * body that carries it could be accepted with the rest of its content: it is refused instead,
 * before anything can strip it.
 * The parser has already built the value, so the real bound on CPU and memory is BODY_LIMIT_KB:
 * these limits only keep this walk cheap. Only keys count; a value that holds the text is fine. Iterative, with a depth and a node limit.
 */
export function inspectJsonValue(root: unknown): BodyInspection {
  const pending: Pending[] = [{ value: root, depth: 1 }];
  let nodes = 0;
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { value, depth } = next;
    nodes += 1;
    if (nodes > MAX_BODY_NODES) {
      return "too-large";
    }
    if (typeof value !== "object" || value === null) {
      continue;
    }
    if (depth > MAX_BODY_DEPTH) {
      return "too-deep";
    }
    if (FORBIDDEN_KEYS.some((key) => Object.hasOwn(value, key))) {
      return "prototype-key";
    }
    for (const child of Object.values(value)) {
      pending.push({ value: child, depth: depth + 1 });
    }
    // Every value waiting counts too, so that a huge array is refused before it is walked.
    if (nodes + pending.length > MAX_BODY_NODES) {
      return "too-large";
    }
  }
  return "ok";
}

/**
 * Express middleware placed right after the body parser, for every route. A body that passed the
 * parser is refused with a fixed 400 when it holds a `__proto__` key or is too deep or too large
 * to be walked.
 */
export function rejectPrototypeKey(request: Request, _response: unknown, next: NextFunction): void {
  next(inspectJsonValue(request.body) === "ok" ? undefined : new UnacceptableBodyError());
}
