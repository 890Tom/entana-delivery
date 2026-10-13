import type { ResellerUpdatePlan } from "@entana/contracts";

/** The columns to write: Prisma ignores the keys that are undefined. */
export interface ResellerWrite {
  readonly name?: string;
  readonly area?: string;
  readonly landmarkText?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly active?: boolean;
  readonly consentAt?: Date | null;
}

type ChangedPlan = Extract<ResellerUpdatePlan, { kind: "changed" }>;

/**
 * The columns of a plan. A consent given is dated now; a consent already given is not in the plan
 * (nothing changes), so its date is kept. A consent withdrawn clears the date.
 */
export function toResellerWrite(plan: ChangedPlan, now: Date): ResellerWrite {
  const { columns, consent } = plan;
  return {
    name: columns.name,
    area: columns.neighborhood,
    landmarkText: columns.landmark,
    lat: columns.latitude,
    lng: columns.longitude,
    active: columns.visible,
    consentAt: consent === null ? undefined : consent.to ? now : null,
  };
}
