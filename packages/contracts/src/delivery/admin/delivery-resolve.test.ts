import { describe, expect, it } from "vitest";
import { MAX_FREE_DELIVERY_MIN_PIECES } from "./delivery-settings-request.js";
import { deliveryResolveQuerySchema } from "./delivery-resolve.js";

describe("deliveryResolveQuerySchema", () => {
  it("reads the coordinates and defaults the pieces to 1", () => {
    const parsed = deliveryResolveQuerySchema.parse({ latitude: "-18.9", longitude: "47.5" });

    expect(parsed).toEqual({ latitude: -18.9, longitude: 47.5, pieces: 1 });
  });

  it.each([
    ["a missing latitude", { longitude: "47.5" }],
    ["a missing longitude", { latitude: "-18.9" }],
    ["a latitude that is not a number", { latitude: "abc", longitude: "47.5" }],
    ["a latitude above 90", { latitude: "90.1", longitude: "47.5" }],
    ["a longitude below -180", { latitude: "0", longitude: "-180.1" }],
    ["pieces of 0", { latitude: "0", longitude: "0", pieces: "0" }],
    ["an unknown parameter", { latitude: "0", longitude: "0", radius: "5" }],
  ])("refuses %s", (_name, query) => {
    expect(deliveryResolveQuerySchema.safeParse(query).success).toBe(false);
  });

  it("accepts the largest order and refuses one piece more", () => {
    const query = { latitude: "0", longitude: "0" };

    expect(
      deliveryResolveQuerySchema.safeParse({
        ...query,
        pieces: String(MAX_FREE_DELIVERY_MIN_PIECES),
      }).success,
    ).toBe(true);
    expect(
      deliveryResolveQuerySchema.safeParse({
        ...query,
        pieces: String(MAX_FREE_DELIVERY_MIN_PIECES + 1),
      }).success,
    ).toBe(false);
  });
});
