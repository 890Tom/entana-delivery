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
  map: {
    styleUrl: "https://tiles.openfreemap.org/styles/liberty",
    center: { lat: -18.91, lng: 47.52 },
    zoom: 12,
  },
};

describe("toPublicInstance", () => {
  it("exposes the shop, the locale, the currency, the phone code, the map and media URLs only", () => {
    const publicInstance = toPublicInstance(config);

    expect(publicInstanceSchema.parse(publicInstance)).toEqual({
      name: "Boutique de démonstration",
      locale: { default: "fr", available: ["fr"] },
      currency: "MGA",
      phoneCountryCode: "261",
      logoUrl: "/media/branding/logo.png",
      appIconUrl: null,
      contactPhone: null,
      theme: null,
      map: {
        styleUrl: "https://tiles.openfreemap.org/styles/liberty",
        center: { lat: -18.91, lng: 47.52 },
        zoom: 12,
      },
    });
    expect(JSON.stringify(publicInstance)).not.toContain("Antananarivo");
  });
});

describe("toPublicInstance theme", () => {
  it("derives the theme from the brand colours of the file", () => {
    const withColors = {
      ...config,
      branding: { colors: { accent: "#2d6cdf", action: "#2b2b2b" } },
    };

    expect(publicInstanceSchema.parse(toPublicInstance(withColors)).theme).toEqual({
      accent: "#2d6cdf",
      accentSoft: "#e0e9fa",
      accentStrong: "#2961c9",
      textOnAccent: "#ffffff",
      action: "#2b2b2b",
      actionHover: "#555555",
      textOnAction: "#ffffff",
    });
  });
});

describe("toPublicInstance contact", () => {
  it("exposes the contact phone of the file as contactPhone", () => {
    const publicInstance = toPublicInstance({ ...config, contact: { phone: "+261341234567" } });

    expect(publicInstanceSchema.parse(publicInstance).contactPhone).toBe("+261341234567");
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

  it("refuses a response without the map or with an extra map key", () => {
    const valid = toPublicInstance(config);

    expect(publicInstanceSchema.safeParse({ ...valid, map: undefined }).success).toBe(false);
    expect(
      publicInstanceSchema.safeParse({ ...valid, map: { ...valid.map, apiKey: "x" } }).success,
    ).toBe(false);
  });

  it("refuses a response without theme, or with a theme that is not a hex colour set", () => {
    const valid = toPublicInstance(config);

    expect(publicInstanceSchema.safeParse({ ...valid, theme: undefined }).success).toBe(false);
    expect(publicInstanceSchema.safeParse({ ...valid, theme: { accent: "red" } }).success).toBe(
      false,
    );
  });

  it("refuses a response without contactPhone", () => {
    const withoutContact = { ...toPublicInstance(config), contactPhone: undefined };

    expect(publicInstanceSchema.safeParse(withoutContact).success).toBe(false);
  });

  it("refuses a shop name with a formatting character", () => {
    const valid = toPublicInstance(config);

    expect(publicInstanceSchema.safeParse({ ...valid, name: "Boutique\u202Eevil" }).success).toBe(
      false,
    );
  });
});
