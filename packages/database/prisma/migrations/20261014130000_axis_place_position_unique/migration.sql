-- One position per place along an axis. Hand-written: Prisma cannot generate a deferrable
-- constraint. Existing links are renumbered 1..n per axis, in the order of their former position.
UPDATE "axis_place" AS link
   SET "position" = numbered.row_number
  FROM (
    SELECT "axis_id", "place_id",
           row_number() OVER (PARTITION BY "axis_id" ORDER BY "position", "place_id") AS row_number
      FROM "axis_place"
  ) AS numbered
 WHERE link."axis_id" = numbered."axis_id" AND link."place_id" = numbered."place_id";

ALTER TABLE "axis_place"
  ADD CONSTRAINT "axis_place_axis_id_position_key"
  UNIQUE ("axis_id", "position") DEFERRABLE INITIALLY IMMEDIATE;
