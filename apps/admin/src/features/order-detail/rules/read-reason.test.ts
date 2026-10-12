import { MAX_STATUS_REASON_LENGTH } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { readReason } from "./read-reason";

describe("readReason", () => {
  it("leaves the reason out when nothing was typed", () => {
    expect(readReason("")).toEqual({ kind: "ok", reason: undefined });
    expect(readReason("   ")).toEqual({ kind: "ok", reason: undefined });
  });

  it("keeps a typed reason, without the spaces around it", () => {
    expect(readReason("  Rupture de stock ")).toEqual({ kind: "ok", reason: "Rupture de stock" });
  });

  it("accepts the longest reason and refuses one more character", () => {
    expect(readReason("a".repeat(MAX_STATUS_REASON_LENGTH)).kind).toBe("ok");
    expect(readReason("a".repeat(MAX_STATUS_REASON_LENGTH + 1))).toEqual({ kind: "too_long" });
  });
});
