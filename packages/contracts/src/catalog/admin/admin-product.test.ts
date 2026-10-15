import { describe, expect, it } from "vitest";
import { availabilityRequestSchema, productOrderRequestSchema } from "./admin-product.js";

const ID = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5a";

describe("availabilityRequestSchema", () => {
  it("accepts a boolean and refuses an extra field", () => {
    expect(availabilityRequestSchema.safeParse({ available: true }).success).toBe(true);
    expect(availabilityRequestSchema.safeParse({ available: true, priceAr: 1 }).success).toBe(
      false,
    );
  });

  it("refuses a value that is not a boolean", () => {
    expect(availabilityRequestSchema.safeParse({ available: "true" }).success).toBe(false);
  });
});

describe("productOrderRequestSchema", () => {
  it("leaves a duplicate to the server, which answers a 409", () => {
    expect(productOrderRequestSchema.safeParse({ ids: [ID, ID] }).success).toBe(true);
  });

  it("refuses an id that is not a uuid and an extra field", () => {
    expect(productOrderRequestSchema.safeParse({ ids: ["x"] }).success).toBe(false);
    expect(productOrderRequestSchema.safeParse({ ids: [], extra: 1 }).success).toBe(false);
  });
});
