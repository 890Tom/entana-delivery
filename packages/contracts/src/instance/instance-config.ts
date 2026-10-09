import { z } from "zod";

// A bare file name: no separator, no ".." and a raster extension (never svg, which can carry
// script). The pattern is the whole defence, so a name that passes it is safe to place in a URL.
const BRANDING_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const BRANDING_FILE_EXTENSION = /\.(png|webp|jpg)$/;

export const brandingFileNameSchema = z
  .string()
  .regex(BRANDING_FILE_PATTERN, "Must be a plain file name.")
  .refine((name) => BRANDING_FILE_EXTENSION.test(name), "Must end with .png, .webp or .jpg.")
  .refine((name) => !name.includes(".."), "Must not contain two consecutive dots.");

// Control and format characters hide text or break lines in a name shown to every customer.
const shopNameSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((name) => /\S/.test(name), "Must contain a visible character.")
  .refine((name) => !/[\p{Cc}\p{Cf}]/u.test(name), "Must not contain control characters.");

function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

const localeCodeSchema = z.string().regex(/^[a-z]{2}$/, "Must be a two-letter language code.");

// A country calling code is 1 to 3 digits and never starts with 0 (what normalizePhone accepts).
export const phoneCountryCodeSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,2}$/, "Must be 1 to 3 digits and must not start with 0.");

/** The instance configuration file (instance.config.yaml). Strict: an unknown key is an error. */
export const instanceConfigSchema = z.strictObject({
  shop: z.strictObject({ name: shopNameSchema }),
  locale: z
    .strictObject({
      default: z.literal("fr"),
      available: z.array(localeCodeSchema).min(1),
    })
    .refine((locale) => locale.available.includes(locale.default), {
      path: ["available"],
      message: "Must contain the default locale.",
    }),
  currency: z.literal("MGA"),
  timezone: z.string().refine(isTimeZone, "Must be an IANA time zone name."),
  phoneCountryCode: phoneCountryCodeSchema,
  branding: z
    .strictObject({
      logoFile: brandingFileNameSchema.optional(),
      appIconFile: brandingFileNameSchema.optional(),
    })
    .optional(),
});

export type InstanceConfig = z.infer<typeof instanceConfigSchema>;
