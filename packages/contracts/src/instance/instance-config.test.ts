import { describe, expect, it } from "vitest";
import { instanceConfigSchema } from "./instance-config.js";

const validConfig = {
  shop: { name: "Boutique de démonstration" },
  locale: { default: "fr", available: ["fr"] },
  currency: "MGA",
  timezone: "Indian/Antananarivo",
  phoneCountryCode: "261",
  branding: { logoFile: "logo.png", appIconFile: "icon.webp" },
};

function invalidPaths(config: unknown): string[] {
  const result = instanceConfigSchema.safeParse(config);
  return result.success
    ? []
    : [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
}

describe("instanceConfigSchema", () => {
  it("accepts a valid configuration, with or without branding", () => {
    expect(instanceConfigSchema.safeParse(validConfig).success).toBe(true);
    const withoutBranding = { ...validConfig, branding: undefined };
    expect(instanceConfigSchema.safeParse(withoutBranding).success).toBe(true);
  });

  it("accepts an optional contact section with a phone, and refuses an unknown key in it", () => {
    const withContact = { ...validConfig, contact: { phone: "034 12 345 67" } };

    expect(instanceConfigSchema.safeParse(withContact).success).toBe(true);
    expect(invalidPaths({ ...validConfig, contact: { phone: "1", email: "x" } })).toEqual([
      "contact",
    ]);
  });

  it("refuses a blank shop name or one with a control character", () => {
    expect(invalidPaths({ ...validConfig, shop: { name: "   " } })).toEqual(["shop.name"]);
    expect(invalidPaths({ ...validConfig, shop: { name: "Bou\ntique" } })).toEqual(["shop.name"]);
    expect(invalidPaths({ ...validConfig, shop: { name: "Bou\u202Etique" } })).toEqual([
      "shop.name",
    ]);
  });

  it("refuses an unknown time zone", () => {
    expect(invalidPaths({ ...validConfig, timezone: "Mars/Olympus" })).toEqual(["timezone"]);
  });

  it("refuses a country code that starts with 0 or has four digits", () => {
    expect(invalidPaths({ ...validConfig, phoneCountryCode: "0261" })).toEqual([
      "phoneCountryCode",
    ]);
    expect(invalidPaths({ ...validConfig, phoneCountryCode: "2611" })).toEqual([
      "phoneCountryCode",
    ]);
  });

  it("refuses a default locale that is not available", () => {
    expect(invalidPaths({ ...validConfig, locale: { default: "fr", available: ["en"] } })).toEqual([
      "locale.available",
    ]);
  });

  it.each(["../logo.png", "a/logo.png", "a\\logo.png", "logo.svg", "logo..png", "logo", ".png"])(
    "refuses the logo file name %s",
    (logoFile) => {
      expect(invalidPaths({ ...validConfig, branding: { logoFile } })).toEqual([
        "branding.logoFile",
      ]);
    },
  );

  it("fills the map with the defaults when the section is absent", () => {
    const parsed = instanceConfigSchema.parse(validConfig);

    expect(parsed.map).toEqual({
      styleUrl: "https://tiles.openfreemap.org/styles/liberty",
      center: { lat: -18.91, lng: 47.52 },
      zoom: 12,
    });
  });

  it("keeps the map fields given and fills the missing ones", () => {
    const parsed = instanceConfigSchema.parse({
      ...validConfig,
      map: { styleUrl: "/tiles/style.json", center: { lat: -18.8 }, zoom: 14 },
    });

    expect(parsed.map).toEqual({
      styleUrl: "/tiles/style.json",
      center: { lat: -18.8, lng: 47.52 },
      zoom: 14,
    });
  });

  it.each(["https://tiles.example.org/styles/main.json", "/tiles/style.json", "/style"])(
    "accepts the map style address %s",
    (styleUrl) => {
      expect(invalidPaths({ ...validConfig, map: { styleUrl } })).toEqual([]);
    },
  );

  it.each([
    ["http", "http://tiles.example.org/style.json"],
    ["credentials in the address", "https://user:pass@tiles.example.org/style.json"],
    ["a javascript: address", "javascript:alert(1)"],
    ["a data: address", "data:application/json,{}"],
    ["a protocol-relative address", "//tiles.example.org/style.json"],
    ["a parent segment", "/tiles/../style.json"],
    ["a space", "https://tiles.example.org/my style.json"],
    ["a control character", "https://tiles.example.org/style\u0007.json"],
    ["more than 300 characters", `https://tiles.example.org/${"a".repeat(300)}`],
  ])("refuses a map style address with %s", (_label, styleUrl) => {
    expect(invalidPaths({ ...validConfig, map: { styleUrl } })).toEqual(["map.styleUrl"]);
  });

  it.each([
    ["a latitude above 90", { center: { lat: 90.5 } }, "map.center.lat"],
    ["a non-finite latitude", { center: { lat: Infinity } }, "map.center.lat"],
    ["a longitude below -180", { center: { lng: -180.5 } }, "map.center.lng"],
    ["a zoom below 1", { zoom: 0.5 }, "map.zoom"],
    ["a zoom above 18", { zoom: 19 }, "map.zoom"],
    ["an unknown key", { tileKey: "x" }, "map"],
  ])("refuses a map with %s", (_label, map, path) => {
    expect(invalidPaths({ ...validConfig, map })).toEqual([path]);
  });

  it("refuses an unknown key", () => {
    const result = instanceConfigSchema.safeParse({ ...validConfig, secret: "x" });
    expect(result.success).toBe(false);
  });
});
