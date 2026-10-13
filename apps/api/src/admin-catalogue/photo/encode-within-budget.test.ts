import { describe, expect, it } from "vitest";
import { encodeWithinBudget } from "./encode-within-budget.js";

const BUDGET = 100;

function fakeEncoder(sizes: Readonly<Record<number, number>>): {
  encode: (quality: number) => Promise<Buffer>;
  tried: number[];
} {
  const tried: number[] = [];
  return {
    tried,
    encode: (quality) => {
      tried.push(quality);
      return Promise.resolve(Buffer.alloc(sizes[quality] ?? 1_000));
    },
  };
}

describe("encodeWithinBudget", () => {
  it("keeps the first quality (85) when the file fits", async () => {
    const encoder = fakeEncoder({ 85: 90 });

    const result = await encodeWithinBudget(encoder.encode, BUDGET);

    expect(result.length).toBe(90);
    expect(encoder.tried).toEqual([85]);
  });

  it("goes down by 4 until the file fits", async () => {
    const encoder = fakeEncoder({ 85: 300, 81: 200, 77: 100 });

    const result = await encodeWithinBudget(encoder.encode, BUDGET);

    expect(result.length).toBe(100);
    expect(encoder.tried).toEqual([85, 81, 77]);
  });

  it("keeps the file of quality 65 when nothing fits", async () => {
    const encoder = fakeEncoder({ 65: 500 });

    const result = await encodeWithinBudget(encoder.encode, BUDGET);

    expect(result.length).toBe(500);
    expect(encoder.tried).toEqual([85, 81, 77, 73, 69, 65]);
  });
});
