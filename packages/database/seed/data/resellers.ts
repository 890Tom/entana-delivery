import { DEMO_CENTRE } from "./config.ts";
import type { SeedContext } from "../lib/sql.ts";
import { daysBefore, insertRow } from "../lib/sql.ts";

interface DemoReseller {
  readonly name: string;
  readonly area: string;
  readonly active: boolean;
  // Days before now; null when it never happened.
  readonly consentDaysAgo: number | null;
  readonly verifiedDaysAgo: number | null;
}

// An active reseller needs the consent of its owner (ck_reseller_consent_when_active).
const DEMO_RESELLERS: readonly DemoReseller[] = [
  {
    name: "Demo Reseller 1",
    area: "Demo Area North",
    active: true,
    consentDaysAgo: 200,
    verifiedDaysAgo: 20,
  },
  // Last verified more than 90 days ago: due for a new verification.
  {
    name: "Demo Reseller 2",
    area: "Demo Area North",
    active: true,
    consentDaysAgo: 400,
    verifiedDaysAgo: 120,
  },
  {
    name: "Demo Reseller 3",
    area: "Demo Area East",
    active: true,
    consentDaysAgo: 60,
    verifiedDaysAgo: 5,
  },
  {
    name: "Demo Reseller 4",
    area: "Demo Area East",
    active: true,
    consentDaysAgo: 30,
    verifiedDaysAgo: null,
  },
  // Paused by choice: consent given, not shown on the public map.
  {
    name: "Demo Reseller 5",
    area: "Demo Area South",
    active: false,
    consentDaysAgo: 90,
    verifiedDaysAgo: 30,
  },
  // No consent: must stay inactive.
  {
    name: "Demo Reseller 6",
    area: "Demo Area South",
    active: false,
    consentDaysAgo: null,
    verifiedDaysAgo: null,
  },
];

export async function seedResellers({ db, now }: SeedContext): Promise<void> {
  for (const [index, reseller] of DEMO_RESELLERS.entries()) {
    await insertRow(db, "reseller", {
      name: reseller.name,
      area: reseller.area,
      landmark_text: `Demo landmark ${String(index + 1)}: next to the fake market`,
      lat: Number((DEMO_CENTRE.lat + 0.004 * (index - 2.5)).toFixed(6)),
      lng: Number((DEMO_CENTRE.lng - 0.004 * (index - 2.5)).toFixed(6)),
      active: reseller.active,
      consent_at:
        reseller.consentDaysAgo === null ? null : daysBefore(now, reseller.consentDaysAgo),
      verified_at:
        reseller.verifiedDaysAgo === null ? null : daysBefore(now, reseller.verifiedDaysAgo),
    });
  }
}
