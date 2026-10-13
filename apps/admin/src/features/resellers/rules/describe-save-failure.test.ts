import { describe, expect, it } from "vitest";

import { describeFailure } from "./describe-save-failure";

describe("what a refused request shows", () => {
  it("says nothing when the session ended: the next read shows the sign-in", () => {
    expect(describeFailure({ kind: "unauthorized" })).toEqual({
      hasPublishError: false,
      notice: null,
      isUnauthorized: true,
    });
  });

  it("puts the refusal to publish on the visibility switch", () => {
    expect(describeFailure({ kind: "invalid", problem: "notPublishable" })).toMatchObject({
      hasPublishError: true,
      notice: null,
    });
  });

  it("says that the reseller is gone, or that the request failed", () => {
    expect(describeFailure({ kind: "not_found" }).notice).toBe("gone");
    expect(describeFailure({ kind: "failure" }).notice).toBe("failed");
  });
});
