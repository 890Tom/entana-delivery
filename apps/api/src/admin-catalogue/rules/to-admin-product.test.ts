import { adminProductSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { toAdminProduct } from "./to-admin-product.js";

const ROW = {
  id: "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5a",
  name: "Fake product",
  sku: "FAKE-1",
  priceAr: 5000,
  description: null,
  imageKey: null,
  imageAlt: null,
  available: false,
  availabilityChangedAt: new Date("2026-10-08T08:00:00.000Z"),
  active: true,
  position: 3,
};

describe("toAdminProduct", () => {
  it("shows an active product as not retired, with an ISO date", () => {
    const product = toAdminProduct(ROW);

    expect(adminProductSchema.parse(product)).toEqual({
      id: ROW.id,
      name: "Fake product",
      sku: "FAKE-1",
      priceAr: 5000,
      available: false,
      availabilityChangedAt: "2026-10-08T08:00:00.000Z",
      retired: false,
      description: null,
      image: null,
      imageAlt: null,
      position: 3,
    });
  });

  it("builds the image from the key and the alt", () => {
    const row = { ...ROW, description: "Short", imageKey: "a.webp", imageAlt: "Alt" };

    expect(toAdminProduct(row)).toMatchObject({
      description: "Short",
      image: { url: "/media/products/a.webp" },
      imageAlt: "Alt",
    });
  });

  it("keeps the alt before the photo exists", () => {
    expect(toAdminProduct({ ...ROW, imageAlt: "Alt" })).toMatchObject({
      image: null,
      imageAlt: "Alt",
    });
  });

  it("shows an inactive product as retired", () => {
    expect(toAdminProduct({ ...ROW, active: false }).retired).toBe(true);
  });
});
