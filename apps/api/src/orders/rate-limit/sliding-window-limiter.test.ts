import { describe, expect, it } from "vitest";
import type { Clock } from "../../clock/clock.js";
import { SlidingWindowLimiter } from "./sliding-window-limiter.js";

class ManualClock implements Clock {
  private current = new Date("2026-10-08T08:00:00.000Z");

  now(): Date {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

const WINDOW_MS = 600_000;

function build(options: { maxHits?: number; maxKeys?: number } = {}): {
  limiter: SlidingWindowLimiter;
  clock: ManualClock;
} {
  const clock = new ManualClock();
  const limiter = new SlidingWindowLimiter(
    { maxHits: options.maxHits ?? 3, windowMs: WINDOW_MS, maxKeys: options.maxKeys ?? 5 },
    clock,
  );
  return { limiter, clock };
}

function hitTimes(limiter: SlidingWindowLimiter, key: string, times: number): void {
  for (let index = 0; index < times; index += 1) {
    limiter.hit(key);
  }
}

describe("SlidingWindowLimiter", () => {
  it("allows the configured number of hits, then refuses", () => {
    const { limiter } = build();

    const answers = [1, 2, 3, 4].map(() => limiter.hit("a"));

    expect(answers).toEqual([true, true, true, false]);
  });

  it("does not affect another key", () => {
    const { limiter } = build();
    hitTimes(limiter, "a", 4);

    expect(limiter.hit("b")).toBe(true);
  });

  it("slides: a hit leaves the window exactly one window after it was made", () => {
    const { limiter, clock } = build();
    limiter.hit("a");
    clock.advance(WINDOW_MS / 2);
    hitTimes(limiter, "a", 2);
    expect(limiter.hit("a")).toBe(false);

    clock.advance(WINDOW_MS / 2);

    expect(limiter.hit("a")).toBe(true);
    expect(limiter.hit("a")).toBe(false);
  });

  it("does not count refused hits, so a refused flood does not extend the block", () => {
    const { limiter, clock } = build();
    hitTimes(limiter, "a", 3);
    clock.advance(WINDOW_MS - 1);
    hitTimes(limiter, "a", 50);

    clock.advance(1);

    expect(limiter.hit("a")).toBe(true);
  });

  it("prunes the keys whose hits have all expired on every hit", () => {
    const { limiter, clock } = build({ maxKeys: 100 });
    hitTimes(limiter, "a", 1);
    hitTimes(limiter, "b", 1);
    clock.advance(WINDOW_MS);

    limiter.hit("c");

    expect(limiter.size).toBe(1);
  });

  it("never tracks more keys than the cap", () => {
    const { limiter } = build({ maxKeys: 5 });

    for (let index = 0; index < 200; index += 1) {
      limiter.hit(`address-${String(index)}`);
    }

    expect(limiter.size).toBe(5);
  });

  it("evicts the least recently seen key that is not limited", () => {
    const { limiter } = build({ maxKeys: 3, maxHits: 3 });
    limiter.hit("old");
    limiter.hit("middle");
    limiter.hit("recent");
    // "old" is seen again: "middle" is now the least recently seen.
    limiter.hit("old");

    limiter.hit("new");

    // "old" kept its two hits: only one more is allowed.
    expect([limiter.hit("old"), limiter.hit("old")]).toEqual([true, false]);
    // "middle" was evicted, so its counter started again: three hits fit.
    expect([1, 2, 3].map(() => limiter.hit("middle"))).toEqual([true, true, true]);
  });

  it("cannot clear the counter of a limited address with a flood of other addresses", () => {
    const { limiter } = build({ maxKeys: 5, maxHits: 3 });
    hitTimes(limiter, "attacker", 4);
    expect(limiter.hit("attacker")).toBe(false);

    for (let index = 0; index < 1000; index += 1) {
      limiter.hit(`flood-${String(index)}`);
    }

    expect(limiter.hit("attacker")).toBe(false);
    expect(limiter.size).toBe(5);
  });

  it("stays limited while the flood keeps refreshing the other addresses", () => {
    const { limiter, clock } = build({ maxKeys: 4, maxHits: 2 });
    hitTimes(limiter, "attacker", 3);

    for (let minute = 0; minute < 9; minute += 1) {
      clock.advance(60_000);
      for (let index = 0; index < 20; index += 1) {
        limiter.hit(`flood-${String(minute)}-${String(index)}`);
      }
      expect(limiter.hit("attacker")).toBe(false);
    }
  });

  it("fails open for a new address when every tracked address is limited, without growing", () => {
    const { limiter } = build({ maxKeys: 2, maxHits: 1 });
    limiter.hit("first");
    limiter.hit("second");
    expect(limiter.hit("first")).toBe(false);
    expect(limiter.hit("second")).toBe(false);

    const answers = [limiter.hit("third"), limiter.hit("third"), limiter.hit("third")];

    expect(answers).toEqual([true, true, true]);
    expect(limiter.size).toBe(2);
    expect(limiter.hit("first")).toBe(false);
  });

  it("lets new addresses in again as soon as a limited one leaves its window while saturated", () => {
    const { limiter, clock } = build({ maxKeys: 2, maxHits: 1 });
    limiter.hit("first");
    clock.advance(1000);
    limiter.hit("second");
    expect(limiter.hit("third")).toBe(true);
    expect(limiter.size).toBe(2);

    clock.advance(WINDOW_MS - 1000);
    limiter.hit("third");

    expect(limiter.hit("third")).toBe(false);
    expect(limiter.hit("second")).toBe(false);
  });

  it("evicts a key whose accepted hits have all expired even though a refused hit refreshed it", () => {
    const { limiter, clock } = build({ maxKeys: 1, maxHits: 1 });
    limiter.hit("first");
    clock.advance(WINDOW_MS - 1);
    expect(limiter.hit("first")).toBe(false);

    clock.advance(1);

    // The refused hit made "first" recently seen, but it is no longer limited: room is made.
    expect(limiter.hit("second")).toBe(true);
    expect(limiter.hit("second")).toBe(false);
    expect(limiter.size).toBe(1);
  });

  it("tracks the new address again once a limited one has expired", () => {
    const { limiter, clock } = build({ maxKeys: 1, maxHits: 1 });
    limiter.hit("first");
    clock.advance(WINDOW_MS);

    limiter.hit("second");

    expect(limiter.hit("second")).toBe(false);
    expect(limiter.size).toBe(1);
  });
});
