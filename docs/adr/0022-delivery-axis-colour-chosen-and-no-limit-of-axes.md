# 0022. The administration chooses the colour of an axis; the number of axes is not limited

- Status: accepted
- Date: 2026-10-14

## Context

ADR 0021 gave each axis a `color_key` from 0 to 9, the smallest free one at creation, unique.
The key picked one of ten colours of the admin palette. Since every axis held its own key, a shop
could not have more than ten axes, inactive ones included. The shop owner needs more axes, and
wants to pick the colour of each one.

## Decision

- `delivery_axis.color` holds the colour chosen by the administration: `#rrggbb` in lower case
  (the value of an `<input type="color">`), checked by `ck_delivery_axis_color_format`. It is not
  unique: two axes may share a colour.
- The body of `POST` and `PUT /api/v1/admin/delivery/axes` requires `color`; a change of colour is
  audited as the field `color`. The responses carry `color` instead of `colorKey`.
- There is no limit on the number of axes: `MAX_DELIVERY_AXES` and the problem
  `delivery_axis_limit_reached` are removed.
- The migration gives the existing axes the colour their key stood for, then drops `color_key`.

## Consequences

- The admin draws an axis with its stored colour; the ten `--color-axis-*` tokens are gone.
- A chosen colour may be hard to read on the map. The name of the axis is always shown next to its
  colour, so no information rests on the colour alone; no contrast check is made.
- Two axes may look alike when they share a colour.

## Alternatives considered

- Keep the ten colours and let them repeat beyond ten axes (the least used one, or the key modulo
  ten): the shop owner wants to choose the colour.
- Choose among the ten colours of the palette: refused for the same reason.
