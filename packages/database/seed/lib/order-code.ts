// No ambiguous characters: neither 0, O, 1 nor I (docs/data-model.md). The database only checks
// the length, so the alphabet is an application rule.
export const ORDER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ORDER_CODE_LENGTH = 6;

// The alphabet holds only letters and digits, so it is safe inside a character class.
const ORDER_CODE_PATTERN = new RegExp(`^[${ORDER_CODE_ALPHABET}]{${String(ORDER_CODE_LENGTH)}}$`);

export function isValidOrderCode(code: string): boolean {
  return ORDER_CODE_PATTERN.test(code);
}
