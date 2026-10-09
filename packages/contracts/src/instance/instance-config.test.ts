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

  it("refuses an unknown key", () => {
    const result = instanceConfigSchema.safeParse({ ...validConfig, secret: "x" });
    expect(result.success).toBe(false);
  });
});
