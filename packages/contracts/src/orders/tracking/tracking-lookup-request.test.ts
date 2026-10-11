import { describe, expect, it } from "vitest";
import { trackingLookupRequestSchema } from "./tracking-lookup-request.js";

const VALID = { phone: "034 00 000 00", orderCode: "ab-c 234" };

describe("trackingLookupRequestSchema", () => {
  it("accepts a phone number and an order code as a customer types them", () => {
    expect(trackingLookupRequestSchema.safeParse(VALID).success).toBe(true);
  });

  it("keeps the order code as sent: the normalisation is the API's", () => {
    expect(trackingLookupRequestSchema.parse(VALID).orderCode).toBe("ab-c 234");
  });

  it.each([
    ["an unknown property", { ...VALID, trackingToken: "A".repeat(43) }],
    ["a missing phone", { orderCode: "ABC234" }],
    ["a missing order code", { phone: VALID.phone }],
    ["a phone with letters", { ...VALID, phone: "034 00 000 0a" }],
    ["an empty order code", { ...VALID, orderCode: "" }],
    ["an order code over 32 characters", { ...VALID, orderCode: "A".repeat(33) }],
    ["an order code that is not a string", { ...VALID, orderCode: 234567 }],
  ])("refuses %s", (_name, body) => {
    expect(trackingLookupRequestSchema.safeParse(body).success).toBe(false);
  });
});
