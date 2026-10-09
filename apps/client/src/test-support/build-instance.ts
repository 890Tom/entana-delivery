import type { PublicInstance } from "@entana/contracts";

export function buildInstance(overrides: Partial<PublicInstance> = {}): PublicInstance {
  return {
    name: "Maison Démo",
    locale: { default: "fr", available: ["fr"] },
    currency: "MGA",
    phoneCountryCode: "261",
    logoUrl: null,
    appIconUrl: null,
    ...overrides,
  };
}
