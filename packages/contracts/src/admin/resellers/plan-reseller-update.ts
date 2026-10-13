import type { UpdateResellerRequest } from "./reseller-form.js";

/** The values of a reseller that a change reads, named as the contract names them. */
export interface ResellerState {
  readonly name: string;
  readonly neighborhood: string;
  readonly landmark: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly consentGiven: boolean;
  readonly visible: boolean;
}

/** The fields audited as an update (the consent and the visibility have their own entries). */
export type ResellerUpdatedField = "name" | "neighborhood" | "landmark" | "latitude" | "longitude";

export type ResellerColumnChanges = Partial<Pick<ResellerState, ResellerUpdatedField | "visible">>;

interface Change<T> {
  readonly from: T;
  readonly to: T;
}

export type ResellerUpdatePlan =
  | { readonly kind: "unchanged" }
  /** The request would leave the reseller visible without the consent. */
  | { readonly kind: "not_publishable" }
  | {
      readonly kind: "changed";
      readonly columns: ResellerColumnChanges;
      readonly fields: readonly ResellerUpdatedField[];
      readonly consent: Change<boolean> | null;
      readonly visibility: Change<boolean> | null;
    };

const UPDATED_FIELDS = ["name", "neighborhood", "landmark", "latitude", "longitude"] as const;

type FlagField = "consentGiven" | "visible";

function flagChange(
  state: ResellerState,
  request: UpdateResellerRequest,
  field: FlagField,
): Change<boolean> | null {
  if (request[field] === undefined || request[field] === state[field]) {
    return null;
  }
  return { from: state[field], to: request[field] };
}

function changedFields(
  state: ResellerState,
  request: UpdateResellerRequest,
): ResellerUpdatedField[] {
  return UPDATED_FIELDS.filter((field) => {
    const value = request[field];
    return value !== undefined && value !== state[field];
  });
}

function isVisibleWithoutConsent(
  state: ResellerState,
  consent: Change<boolean> | null,
  visibility: Change<boolean> | null,
): boolean {
  const isVisible = visibility?.to ?? state.visible;
  const hasConsent = consent?.to ?? state.consentGiven;
  return isVisible && !hasConsent;
}

/**
 * What a partial change does to a reseller. A visible reseller never loses its consent by
 * accident: the request must hide it too, otherwise it is refused (never hidden silently).
 */
export function planResellerUpdate(
  before: ResellerState,
  request: UpdateResellerRequest,
): ResellerUpdatePlan {
  const consent = flagChange(before, request, "consentGiven");
  const visibility = flagChange(before, request, "visible");
  if (isVisibleWithoutConsent(before, consent, visibility)) {
    return { kind: "not_publishable" };
  }
  const fields = changedFields(before, request);
  if (fields.length === 0 && consent === null && visibility === null) {
    return { kind: "unchanged" };
  }
  const columns: ResellerColumnChanges = {
    ...Object.fromEntries(fields.map((field) => [field, request[field]])),
    ...(visibility === null ? {} : { visible: visibility.to }),
  };
  return { kind: "changed", columns, fields, consent, visibility };
}
