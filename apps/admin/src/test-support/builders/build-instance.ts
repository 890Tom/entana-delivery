import type { PublicInstance } from "@entana/contracts";

export function buildInstance(overrides: Partial<PublicInstance> = {}): PublicInstance {
  return {
    name: "Maison Démo",
    locale: { default: "fr", available: ["fr"] },
    currency: "MGA",
    phoneCountryCode: "261",
    logoUrl: null,
    appIconUrl: null,
    contactPhone: null,
    theme: null,
    map: {
      styleUrl: "https://tiles.openfreemap.org/styles/liberty",
      center: { lat: -18.91, lng: 47.52 },
      zoom: 12,
    },
    ...overrides,
  };
}
