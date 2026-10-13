// Typed domain errors of the administration of the resellers. Every message is a fixed text: an
// id, a name or a position never reaches an error, a log line or a property.

/** The id is malformed or unknown: one error for both, so that no answer tells them apart. */
export class AdminResellerNotFoundError extends Error {
  constructor() {
    super("No reseller matches this id.");
    this.name = "AdminResellerNotFoundError";
  }
}

/** Only a reseller whose owner gave the consent can be visible (ck_reseller_consent_when_active). */
export class ResellerNotPublishableError extends Error {
  constructor() {
    super("The reseller needs the consent of its owner to be visible.");
    this.name = "ResellerNotPublishableError";
  }
}
