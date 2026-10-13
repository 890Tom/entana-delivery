import type { AdminReseller } from "@entana/contracts";

const DAY_MS = 86_400_000;

/** An instant `days` days before now, as the API writes it. */
export const daysAgoIso = (days: number): string =>
  new Date(Date.now() - days * DAY_MS).toISOString();

/** A reseller of the admin list. The index makes its id and name unique. */
export function buildReseller(
  index: number,
  overrides: Partial<AdminReseller> = {},
): AdminReseller {
  return {
    id: `0199f5b0-7c1e-7a3b-9d4f-${String(index).padStart(12, "0")}`,
    name: `Revendeur ${String(index)}`,
    neighborhood: `Quartier ${String(index)}`,
    landmark: "Face à la pharmacie",
    latitude: -18.9097,
    longitude: 47.5236,
    consentGiven: true,
    visible: true,
    verifiedAt: daysAgoIso(12),
    ...overrides,
  };
}
