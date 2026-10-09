import { describe, expect, it } from "vitest";
import type { InstanceConfig } from "./instance-config.js";
import { publicInstanceSchema, toPublicInstance } from "./public-instance.js";

const config: InstanceConfig = {
  shop: { name: "Boutique de démonstration" },
  locale: { default: "fr", available: ["fr"] },
  currency: "MGA",
  timezone: "Indian/Antananarivo",
  phoneCountryCode: "261",
  branding: { logoFile: "logo.png" },
};

describe("toPublicInstance", () => {
  it("exposes the shop, the locale, the currency, the phone code and media URLs only", () => {
    const publicInstance = toPublicInstance(config);

    expect(publicInstanceSchema.parse(publicInstance)).toEqual({
      name: "Boutique de démonstration",
      locale: { default: "fr", available: ["fr"] },
      currency: "MGA",
      phoneCountryCode: "261",
      logoUrl: "/media/branding/logo.png",
      appIconUrl: null,
    });
    expect(JSON.stringify(publicInstance)).not.toContain("Antananarivo");
  });
});

describe("publicInstanceSchema", () => {
  it("refuses a media URL outside the branding folder and an extra key", () => {
    const valid = toPublicInstance(config);

    expect(publicInstanceSchema.safeParse({ ...valid, logoUrl: "/etc/passwd" }).success).toBe(
      false,
    );
    expect(publicInstanceSchema.safeParse({ ...valid, timezone: "UTC" }).success).toBe(false);
  });
});
