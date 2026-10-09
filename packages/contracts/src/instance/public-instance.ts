import { z } from "zod";
import { brandingFileNameSchema, phoneCountryCodeSchema } from "./instance-config.js";
import type { InstanceConfig } from "./instance-config.js";

const BRANDING_URL_PREFIX = "/media/branding/";

const brandingUrlSchema = z
  .string()
  .refine(
    (url) =>
      url.startsWith(BRANDING_URL_PREFIX) &&
      brandingFileNameSchema.safeParse(url.slice(BRANDING_URL_PREFIX.length)).success,
    "Must be a branding media URL.",
  )
  .nullable();

/** Response of GET /api/v1/instance: what the customer app may know. Nothing internal. */
export const publicInstanceSchema = z.strictObject({
  name: z.string().min(1),
  locale: z.strictObject({ default: z.string(), available: z.array(z.string()).min(1) }),
  currency: z.literal("MGA"),
  phoneCountryCode: phoneCountryCodeSchema,
  logoUrl: brandingUrlSchema,
  appIconUrl: brandingUrlSchema,
});

export type PublicInstance = z.infer<typeof publicInstanceSchema>;

function toBrandingUrl(file: string | undefined): string | null {
  return file === undefined ? null : `${BRANDING_URL_PREFIX}${file}`;
}

/** The public part of the configuration; the time zone and the file names stay on the server. */
export function toPublicInstance(config: InstanceConfig): PublicInstance {
  return {
    name: config.shop.name,
    locale: { default: config.locale.default, available: [...config.locale.available] },
    currency: config.currency,
    phoneCountryCode: config.phoneCountryCode,
    logoUrl: toBrandingUrl(config.branding?.logoFile),
    appIconUrl: toBrandingUrl(config.branding?.appIconFile),
  };
}
