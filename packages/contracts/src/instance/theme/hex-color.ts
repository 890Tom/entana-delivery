import { z } from "zod";

const HEX_COLOR_MESSAGE = "Must be a #rrggbb colour.";

/** A `#rrggbb` colour in lower case: the form of every colour the public instance answers. */
export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/, HEX_COLOR_MESSAGE);

/**
 * A `#rrggbb` colour as written in the configuration file: either case is accepted and kept in
 * lower case. No short form, no name and no function, so that every value reads the same way.
 */
export const configHexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, HEX_COLOR_MESSAGE)
  .transform((color) => color.toLowerCase());
