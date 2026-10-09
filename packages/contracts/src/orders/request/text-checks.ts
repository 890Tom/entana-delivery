const LAST_C0_CONTROL = 0x1f;
const DELETE = 0x7f;
const LAST_C1_CONTROL = 0x9f;
const NEWLINE = 0x0a;

const isControlCode = (code: number): boolean => {
  return code <= LAST_C0_CONTROL || (code >= DELETE && code <= LAST_C1_CONTROL);
};

/**
 * True when the text holds a C0 control character, DELETE or a C1 control character. The
 * loop walks UTF-16 code units, which is enough: a surrogate half is never a control code.
 */
export const hasControlCharacter = (text: string): boolean => {
  for (let index = 0; index < text.length; index += 1) {
    if (isControlCode(text.charCodeAt(index))) {
      return true;
    }
  }
  return false;
};

/** Same as `hasControlCharacter`, except that a newline (`\n`) is allowed. */
export const hasControlCharacterOtherThanNewline = (text: string): boolean => {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code !== NEWLINE && isControlCode(code)) {
      return true;
    }
  }
  return false;
};

// The whole Unicode category Cf (format characters) is rejected on purpose, plus U+2028 and
// U+2029 (line and paragraph separators). These characters are invisible or change how text is
// displayed: a right-to-left override (U+202E) or an isolate (U+2066) lets a customer reorder
// what an admin or a driver reads, and zero-width characters (U+200B, U+2060, U+FEFF) make a name
// look filled in while it is empty or make two names look equal. The category also contains
// U+200C and U+200D, so a composed emoji joined by a zero-width joiner (a family, a skin tone
// sequence with a joiner) is not accepted in a name: that is a deliberate cost, a plain emoji
// stays valid. The pattern is one character class with no repetition, so it runs in linear time,
// and it only ever sees a string whose length has already been bounded.
const INVISIBLE_CHARACTER_PATTERN = /[\p{Cf}\u2028\u2029]/u;

/** True when the text holds a format character (category Cf), U+2028 or U+2029. */
export const hasInvisibleCharacter = (text: string): boolean => {
  return INVISIBLE_CHARACTER_PATTERN.test(text);
};
