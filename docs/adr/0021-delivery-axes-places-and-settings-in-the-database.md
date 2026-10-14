# 0021. Delivery axes, places and settings live in the database; free delivery in an axis, fee frozen on the order

- Status: accepted; the colour of an axis and the limit of ten axes are replaced by [0022](0022-delivery-axis-colour-chosen-and-no-limit-of-axes.md)
- Date: 2026-10-14

## Context

Delivery is free along the routes the shop already drives, and costs a flat fee elsewhere. The
shop owner must be able to change the axes, the places and the fee without a deployment, and a
change must never alter an order that was already taken.

## Decision

- Places, axes, the link between them and the settings are rows of `place`, `delivery_axis`,
  `axis_place` and `shop_setting`. No configuration file holds them.
- An axis has a `rank` (priority, 1 is the highest, no duplicate) and a `color_key` (0 to 9, the
  smallest free value at creation, never changed). At most 10 axes. Names of places and of axes
  are unique without regard to case.
- When an address is in several axes, the axis of the lowest rank applies; in it, the place whose
  centre is the closest.
- Delivery is free inside an axis. Outside, one flat fee from the settings applies. From a number
  of pieces (setting) delivery is free everywhere. The axis is reported first when both hold.
- The rules are pure functions of `packages/contracts` (`resolveDeliveryAxis`,
  `computeDeliveryFee`). Radius, threshold, fee and message are parameters, never written in a
  rule.
- The fee, the reason, the place and the axis are frozen on the order at creation. Changing an
  axis, a place or a setting does not change a past order.
- The only delivery text that the administration edits is `out_of_axis_message`; the other
  messages are fixed in the client dictionary.

## Consequences

- The migration turns the existing `position` into `rank`, renumbered 1..n, and gives the
  existing axes the colour keys 0..n-1. It does not touch `customer_order`.
- The reason `quantity` of the fee is stored as the `fee_reason` value `QUANTITY`, added when the
  quote was branched on the creation of an order (migration `fee_reason_quantity`). The rule maps
  `axis` to `IN_AXIS`, `out_of_axis` to `OUT_OF_AXIS` and `quantity` to `QUANTITY`; orders created
  before keep their values.
- Case-insensitive uniqueness uses expression indexes (`lower(name)`), written by hand in the
  migration.

## Alternatives considered

- **Settings in the instance configuration file:** needs a deployment to change a fee.
- **A colour computed from the rank:** the colour of an axis would change when axes are
  reordered.
