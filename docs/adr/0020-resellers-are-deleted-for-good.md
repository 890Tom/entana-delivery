# 0020. Resellers are deleted for good, with an audit entry that holds the id only

- Status: accepted
- Date: 2026-10-13

## Context

The standards say rows are deactivated, not deleted (section 8), so that history stays intact. A
reseller is a different case: nothing points at it (no order, no foreign key), it is a point of sale
of a small shop, and its owner may ask to disappear. Keeping the row of a person who withdrew would
keep their name and position in the database for nothing.

## Decision

- `DELETE /api/v1/admin/resellers/:id` removes the row for good (`204`).
- The audit entry `reseller.deleted` is written in the same transaction and holds the id only: no
  name, no position, no phone. `audit_log.entity_id` has no foreign key, so the entry survives.
- The consent history lives in the audit entries `reseller.consent_changed`.
- Products, axes and places keep the rule: they are deactivated, not deleted.

## Consequences

- A deletion cannot be undone: the administration screen must ask for a confirmation.
- The rule "rows are deactivated" has one more exception beside the sessions of the administration.

## Alternatives considered

- **Hide the reseller (`visible: false`):** keeps the personal data of someone who asked to leave.
- **Soft delete with a `deleted_at` column:** needs a migration and the same personal data stays.
