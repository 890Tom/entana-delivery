import { createOrderRequestSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { buildDrafts } from "../../../test-support/builders/build-order-submission";

import { buildOrderRequest } from "./build-order-request";

describe("the body of an order", () => {
  it("is made of the cart and the drafts, with the canonical phone and no price or fee", () => {
    const built = buildOrderRequest(buildDrafts({ note: "Avant 15h." }));

    expect(built).toEqual({
      ok: true,
      request: {
        phone: "+261341234567",
        contactName: "Rakoto Jean",
        customerNote: "Avant 15h.",
        landmarkText: "Portail bleu",
        location: { lat: -18.912346, lng: 47.512346 },
        items: [{ productId: "00000000-0000-4000-8000-000000000001", quantity: 2 }],
      },
    });
    const withToken = { ...(built.ok ? built.request : {}), trackingToken: "A".repeat(43) };
    expect(createOrderRequestSchema.safeParse(withToken).success).toBe(true);
  });

  it("leaves the note out when it is empty", () => {
    const built = buildOrderRequest(buildDrafts({ note: "" }));

    expect(built.ok && "customerNote" in built.request).toBe(false);
  });

  it("keeps the landmark as it was typed", () => {
    const built = buildOrderRequest(buildDrafts({ landmark: " Portail  bleu " }));

    expect(built.ok && built.request.landmarkText).toBe(" Portail  bleu ");
  });

  it("names the faulty fields without any value, and is not built", () => {
    const built = buildOrderRequest(
      buildDrafts({ lines: [], point: null, landmark: "", name: "", phone: "12" }),
    );

    expect(built).toEqual({
      ok: false,
      fields: ["phone", "contactName", "landmarkText", "location", "items"],
    });
  });

  it("refuses a phone number when the country is not known yet", () => {
    expect(buildOrderRequest(buildDrafts({ countryCode: undefined }))).toEqual({
      ok: false,
      fields: ["phone"],
    });
  });
});
