import { createOrderRequestSchema, idempotencyKeySchema } from "@entana/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAttemptIds,
  generateIdempotencyKey,
  generateTrackingToken,
} from "./order-attempt-ids";

const filled = (value: number) => (count: number) => new Uint8Array(count).fill(value);
const V4_LOWERCASE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the tracking token", () => {
  it("is 32 random bytes in base64url without padding, 43 characters the contract accepts", () => {
    const source = vi.fn(filled(0xfb));

    const token = generateTrackingToken(source);

    expect(source).toHaveBeenCalledExactlyOnceWith(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createOrderRequestSchema.shape.trackingToken.safeParse(token).success).toBe(true);
  });
});

describe("the idempotency key", () => {
  it("is a lowercase version 4 uuid made of 16 random bytes", () => {
    const source = vi.fn(filled(0xff));

    const key = generateIdempotencyKey(source);

    expect(source).toHaveBeenCalledExactlyOnceWith(16);
    expect(key).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(idempotencyKeySchema.safeParse(key).success).toBe(true);
  });
});

describe("the ids of an attempt", () => {
  it("are made together from the browser's random source by default", () => {
    const ids = createAttemptIds();

    expect(ids?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(ids?.key).toMatch(V4_LOWERCASE);
  });

  it("are not made when the browser has no getRandomValues", () => {
    vi.stubGlobal("crypto", {});

    expect(createAttemptIds()).toBeNull();
  });
});
