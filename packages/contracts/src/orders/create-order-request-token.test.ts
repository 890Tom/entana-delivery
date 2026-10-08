import { describe, expect, it } from "vitest";
import { createOrderRequestSchema } from "./create-order-request.js";
import {
  VALID_TRACKING_TOKEN,
  buildRequest,
  isAccepted,
  issueMessages,
  rejectedPaths,
} from "./test-support/create-order-request-builder.js";

const withToken = (trackingToken: unknown): Record<string, unknown> => {
  return buildRequest({ trackingToken });
};

describe("createOrderRequestSchema trackingToken", () => {
  it("accepts 43 characters of the base64url alphabet, and returns them unchanged", () => {
    expect(createOrderRequestSchema.parse(buildRequest()).trackingToken).toBe(VALID_TRACKING_TOKEN);
  });

  it("accepts the hyphen and the underscore", () => {
    expect(isAccepted(withToken(`-_${VALID_TRACKING_TOKEN.slice(2)}`))).toBe(true);
  });

  it("rejects a request without a token", () => {
    const withoutToken = Object.fromEntries(
      Object.entries(buildRequest()).filter(([key]) => key !== "trackingToken"),
    );
    expect(rejectedPaths(withoutToken)).toEqual(["trackingToken"]);
  });

  it.each([42, 44])("rejects a token of %i characters", (length) => {
    expect(rejectedPaths(withToken("a".repeat(length)))).toEqual(["trackingToken"]);
  });

  it("rejects a character outside the alphabet", () => {
    expect(rejectedPaths(withToken(`${VALID_TRACKING_TOKEN.slice(1)}+`))).toEqual([
      "trackingToken",
    ]);
    expect(rejectedPaths(withToken(`${VALID_TRACKING_TOKEN.slice(1)}=`))).toEqual([
      "trackingToken",
    ]);
  });

  it("rejects a token that is not a string", () => {
    expect(rejectedPaths(withToken(12))).toEqual(["trackingToken"]);
  });

  it("checks the length before the pattern: a wrong length gives one issue", () => {
    expect(issueMessages(withToken("+".repeat(44)))).toHaveLength(1);
  });

  it("never repeats the token in a message", () => {
    const secret = "!".repeat(43);
    const result = createOrderRequestSchema.safeParse(withToken(secret));
    expect(JSON.stringify(result.error?.issues)).not.toContain(secret);
  });
});
