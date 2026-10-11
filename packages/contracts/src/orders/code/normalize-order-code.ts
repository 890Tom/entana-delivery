/**
 * The order code as a customer may type it (lowercase, spaces or hyphens by groups) turned into
 * the canonical form `orderCodeSchema` validates. Only the letters a-z are uppercased: a locale
 * uppercase would fold other alphabets into the code alphabet ("ß" into "SS"). The caller bounds
 * the length of the input first.
 */
export const normalizeOrderCode = (input: string): string => {
  return input.replace(/[\s-]/g, "").replace(/[a-z]/g, (letter) => letter.toUpperCase());
};
