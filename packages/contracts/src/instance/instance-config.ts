import { z } from "zod";

// A bare file name: no separator, no ".." and a raster extension (never svg, which can carry
// script). The pattern is the whole defence, so a name that passes it is safe to place in a URL.
const MEDIA_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MEDIA_FILE_EXTENSION = /\.(png|webp|jpg)$/;

/** The name of a file of the media folder (branding or product photo). */
export const mediaFileNameSchema = z
  .string()
  .regex(MEDIA_FILE_PATTERN, "Must be a plain file name.")
  .refine((name) => MEDIA_FILE_EXTENSION.test(name), "Must end with .png, .webp or .jpg.")
  .refine((name) => !name.includes(".."), "Must not contain two consecutive dots.");

// Control and format characters hide text or break lines in a name shown to every customer.
export const shopNameSchema = z
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

// Default style of the public OpenFreeMap instance, as given by its quick start guide
// (https://openfreemap.org/quick_start/): no key, no account.
const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// Approximate centre of Antananarivo: to be adjusted by each shop.
const DEFAULT_MAP_CENTER = { lat: -18.91, lng: 47.52 };
const DEFAULT_MAP_ZOOM = 12;

const MAP_STYLE_URL_MAX_LENGTH = 300;
// A path of the same origin (a self-hosted style): one leading slash, a short safe alphabet.
const SAME_ORIGIN_PATH = /^\/[A-Za-z0-9._~/-]{1,200}$/;
const HIDDEN_CHARACTER = /[\s\p{Cc}]/u;

function isSameOriginPath(value: string): boolean {
  return SAME_ORIGIN_PATH.test(value) && !value.includes("//") && !value.includes("..");
}

// The address is read by the browser of every customer: https only, and no credential in it. The
// host alphabet has no "@" or backslash, so "user:pass@host" cannot pass; a regular expression
// because this package uses no URL parser (it has no Node or DOM types).
const HTTPS_URL = /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(?::[0-9]{1,5})?(?:[/?#]\S*)?$/;

/** The address of the map style: an absolute https URL or a path of the same origin. */
export const mapStyleUrlSchema = z
  .string()
  .max(MAP_STYLE_URL_MAX_LENGTH)
  .refine(
    (value) => !HIDDEN_CHARACTER.test(value),
    "Must not contain a space or a control character.",
  )
  .refine(
    (value) => isSameOriginPath(value) || HTTPS_URL.test(value),
    "Must be an https URL without credentials or a path of the same origin.",
  );

export const latitudeSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);
export const zoomSchema = z.number().min(1).max(18);

// Every field has a default, so a configuration written before this section keeps starting.
const mapConfigSchema = z
  .strictObject({
    styleUrl: mapStyleUrlSchema.default(DEFAULT_MAP_STYLE_URL),
    center: z
      .strictObject({
        lat: latitudeSchema.default(DEFAULT_MAP_CENTER.lat),
        lng: longitudeSchema.default(DEFAULT_MAP_CENTER.lng),
      })
      .prefault({}),
    zoom: zoomSchema.default(DEFAULT_MAP_ZOOM),
  })
  .prefault({});

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
      logoFile: mediaFileNameSchema.optional(),
      appIconFile: mediaFileNameSchema.optional(),
    })
    .optional(),
  // Only the shape is checked here: the loader checks the number against the numbering rule of
  // `phoneCountryCode` and keeps its canonical form.
  contact: z.strictObject({ phone: z.string() }).optional(),
  map: mapConfigSchema,
});

export type InstanceConfig = z.infer<typeof instanceConfigSchema>;
