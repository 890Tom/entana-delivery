import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health.js";

const validHealth = { status: "ok", service: "@entana/api", version: "1.2.3", uptimeSeconds: 12 };

describe("healthResponseSchema", () => {
  it("accepts a liveness response", () => {
    expect(healthResponseSchema.safeParse(validHealth).success).toBe(true);
  });

  it("refuses a status other than ok", () => {
    expect(healthResponseSchema.safeParse({ ...validHealth, status: "down" }).success).toBe(false);
  });

  it("refuses a fractional or negative uptime", () => {
    expect(healthResponseSchema.safeParse({ ...validHealth, uptimeSeconds: 1.5 }).success).toBe(
      false,
    );
    expect(healthResponseSchema.safeParse({ ...validHealth, uptimeSeconds: -1 }).success).toBe(
      false,
    );
  });
});
