import { normalizeOrderCode, orderCodeSchema, parsePhoneNumber } from "@entana/contracts";
import type { TrackingLookupRequest } from "@entana/contracts";

/**
 * The canonical order code of what was typed (capitals, no space or hyphen), or null when it
 * cannot be a code. Checked here so that a code of the wrong shape is told at once, whereas the
 * server answers "not found" for it like for any unknown one.
 */
export function readOrderCode(typed: string): string | null {
  const parsed = orderCodeSchema.safeParse(normalizeOrderCode(typed));
  return parsed.success ? parsed.data : null;
}

/** The request of the lookup, or null while the number or the code is not valid. */
export function toLookupRequest(
  phoneDisplay: string,
  typedCode: string,
  countryCode: string,
): TrackingLookupRequest | null {
  const digits = phoneDisplay.replace(/[^0-9]/g, "");
  const phone = parsePhoneNumber(`+${countryCode}${digits}`, countryCode);
  const orderCode = readOrderCode(typedCode);
  return phone.ok && orderCode !== null ? { phone: phone.e164, orderCode } : null;
}
