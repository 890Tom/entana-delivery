import { describe, expect, it } from "vitest";

import { buildAttempt } from "../../test-support/build-order-submission";
import { buildProductId } from "../../test-support/build-product";

import { isSameRequest } from "./is-same-request";

const stored = buildAttempt().request;
const body = {
  phone: "+261341234567",
  contactName: "Rakoto Jean",
  landmarkText: "Portail bleu",
  location: { lat: -18.912346, lng: 47.512346 },
  items: [{ productId: buildProductId(1), quantity: 2 }],
};

describe("the comparison of a request with the stored one", () => {
  it("holds for the same order, whatever the order of the keys", () => {
    const reordered = {
      items: body.items,
      location: body.location,
      landmarkText: body.landmarkText,
      contactName: body.contactName,
      phone: body.phone,
    };

    expect(isSameRequest(stored, reordered)).toBe(true);
  });

  it("does not hold when a field of the schema differs", () => {
    const moved = { ...body, location: { lat: body.location.lat, lng: body.location.lng + 1 } };

    expect(isSameRequest(stored, moved)).toBe(false);
  });

  it("does not hold when a note appears", () => {
    expect(isSameRequest(stored, { ...body, customerNote: "Avant 15h." })).toBe(false);
  });
});
