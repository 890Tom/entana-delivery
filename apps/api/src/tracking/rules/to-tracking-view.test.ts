import { describe, expect, it } from "vitest";
import { trackingResponseSchema } from "@entana/contracts";
import { CUSTOMER_CANCELLATION_REASON, toTrackingView } from "./to-tracking-view.js";
import type { TrackedOrder } from "./to-tracking-view.js";

function build(overrides: Partial<TrackedOrder> = {}): TrackedOrder {
  return {
    publicCode: "ABC234",
    status: "NEW",
    deliveryDate: null,
    landmarkText: "Example landmark",
    totalAr: 12000,
    deliveryFee: 2000,
    itemCount: 3,
    createdAt: new Date("2026-10-08T08:00:00.000Z"),
    statusReason: null,
    ...overrides,
  };
}

describe("toTrackingView", () => {
  it("maps the columns to the shared response, which accepts it", () => {
    const view = toTrackingView(
      build({ status: "CONFIRMED", deliveryDate: new Date("2026-10-12") }),
    );

    expect(trackingResponseSchema.parse(view)).toEqual({
      orderCode: "ABC234",
      status: "CONFIRMED",
      deliveryDate: "2026-10-12",
      landmarkText: "Example landmark",
      totalAr: 12000,
      deliveryFeeAr: 2000,
      itemCount: 3,
      createdAt: "2026-10-08T08:00:00.000Z",
      rejectionReason: null,
      canCancel: true,
    });
  });

  it("keeps the calendar day of the date column, with no time zone conversion", () => {
    // A `date` column comes back as midnight UTC: converting it to Antananarivo (UTC+3) or to a
    // zone west of UTC would move the day.
    const view = toTrackingView(build({ deliveryDate: new Date("2026-12-31T00:00:00.000Z") }));

    expect(view.deliveryDate).toBe("2026-12-31");
  });

  it("exposes the reason of a refusal", () => {
    const view = toTrackingView(build({ status: "REJECTED", statusReason: "Out of stock." }));

    expect(view.rejectionReason).toBe("Out of stock.");
  });

  it.each(["CANCELLED", "FAILED", "NEW", "CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERED"] as const)(
    "never shows a reason as a refusal for %s",
    (status) => {
      const view = toTrackingView(build({ status, statusReason: CUSTOMER_CANCELLATION_REASON }));

      expect(view.rejectionReason).toBeNull();
    },
  );

  it("writes the cancellation reason once, as a fixed text", () => {
    expect(CUSTOMER_CANCELLATION_REASON).toBe("Annulée par le client.");
  });
});
