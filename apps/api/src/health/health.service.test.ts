import { describe, expect, it } from "vitest";
import type { Clock } from "../clock.js";
import { HealthService } from "./health.service.js";

function buildClock(startMs: number): {
  clock: Clock;
  advanceSeconds: (seconds: number) => void;
} {
  let nowMs = startMs;
  return {
    clock: { now: () => new Date(nowMs) },
    advanceSeconds: (seconds) => {
      nowMs += seconds * 1000;
    },
  };
}

describe("HealthService", () => {
  const appInfo = { name: "@entana/api", version: "1.2.3" };

  it("reports the service name and version", () => {
    const { clock } = buildClock(0);
    expect(new HealthService(clock, appInfo).check()).toMatchObject({
      status: "ok",
      service: "@entana/api",
      version: "1.2.3",
    });
  });

  it("reports the whole seconds elapsed since it was created", () => {
    const { clock, advanceSeconds } = buildClock(Date.UTC(2026, 9, 5));
    const service = new HealthService(clock, appInfo);
    advanceSeconds(90.9);
    expect(service.check().uptimeSeconds).toBe(90);
  });

  it("starts at zero", () => {
    const { clock } = buildClock(5_000);
    expect(new HealthService(clock, appInfo).check().uptimeSeconds).toBe(0);
  });
});
