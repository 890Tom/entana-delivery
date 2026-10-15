import { describe, expect, it } from "vitest";
import { toAdminOrderDetail, toAdminOrderListItem } from "./to-admin-order.js";
import type { StoredAdminOrder } from "./to-admin-order.js";

const STORED: StoredAdminOrder = {
  id: "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5f",
  publicCode: "ABC234",
  status: "REJECTED",
  createdAt: new Date("2026-10-08T08:00:00.000Z"),
  deliveryDate: new Date("2026-10-12"),
  contactName: "Fake Person",
  landmarkText: "Fake landmark",
  totalAr: 10000,
  customer: { phoneE164: "+261340000000" },
  items: [{ productName: "Fake product", unitPrice: 5000, qty: 2 }],
  place: { name: "Fake place" },
  axis: { name: "Fake axis" },
  deliveryFee: 0,
  customerNote: null,
  lat: -18.9,
  lng: 47.5,
  statusReason: "Out of stock.",
  events: [],
};

describe("toAdminOrderDetail", () => {
  it("gives the delivery date as the stored day and the reason of a refusal", () => {
    const detail = toAdminOrderDetail(STORED);

    expect(detail.deliveryDate).toBe("2026-10-12");
    expect(detail.rejectionReason).toBe("Out of stock.");
    expect(detail.itemCount).toBe(2);
  });

  it("does not show the reason of a cancellation as a refusal", () => {
    const detail = toAdminOrderDetail({ ...STORED, status: "CANCELLED" });

    expect(detail.rejectionReason).toBeNull();
  });
});

describe("the delivery zone of an order", () => {
  it("names the place and the axis of an order in an axis", () => {
    expect(toAdminOrderDetail(STORED).deliveryZone).toEqual({
      placeName: "Fake place",
      axisName: "Fake axis",
    });
  });

  it("is null for an order outside every axis", () => {
    expect(toAdminOrderDetail({ ...STORED, place: null, axis: null }).deliveryZone).toBeNull();
  });
});

describe("toAdminOrderListItem", () => {
  const row = { ...STORED, customerId: "0199f5b0-0000-7000-8000-000000000001" };

  it("names the customer as the order does and tells a first order by its id", () => {
    const first = toAdminOrderListItem(row, new Set([STORED.id]));
    const next = toAdminOrderListItem(row, new Set(["0199f5b0-0000-7000-8000-000000000002"]));

    expect([first.customerName, first.isNewCustomer]).toEqual(["Fake Person", true]);
    expect(next.isNewCustomer).toBe(false);
  });
});
