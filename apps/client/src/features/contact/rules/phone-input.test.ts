import { describe, expect, it } from "vitest";

import { caretAfterDigits, checkPhone, readPhoneEdit } from "./phone-input";

const CODE = "261";

describe("the edit of the phone field", () => {
  it("puts a digit inserted in the middle in the right place, with the caret after it", () => {
    // "34 12" with a 7 typed after the 4: the field holds "347 12", the caret is after the 7.
    const edit = readPhoneEdit({
      raw: "347 12",
      caret: 3,
      previousDisplay: "34 12",
      inputType: "insertText",
      countryCode: CODE,
    });

    expect(edit).toEqual({ digits: "34712", caretDigits: 3 });
    expect(caretAfterDigits("34 71 2", edit.caretDigits)).toBe(4);
  });

  it("puts the caret at the end when the digit is typed at the end", () => {
    const edit = readPhoneEdit({
      raw: "34 123",
      caret: 6,
      previousDisplay: "34 12",
      inputType: "insertText",
      countryCode: CODE,
    });

    expect(caretAfterDigits("34 12 3", edit.caretDigits)).toBe(7);
  });

  it("puts the caret at the end after a paste", () => {
    const edit = readPhoneEdit({
      raw: "+261 34 12 345 67",
      caret: 17,
      previousDisplay: "",
      inputType: "insertFromPaste",
      countryCode: CODE,
    });

    expect(edit.digits).toBe("341234567");
    expect(caretAfterDigits("34 12 345 67", edit.caretDigits)).toBe(12);
  });

  it.each([
    ["Backspace", "deleteContentBackward", "31234567", 1],
    ["Delete", "deleteContentForward", "34234567", 2],
    ["a deletion whose kind is not told (Backspace is the default)", undefined, "31234567", 1],
  ])("removes the digit next to a formatting space on %s", (_label, inputType, digits, caret) => {
    // The space after "34" was removed by the key: the caret is between "34" and "12".
    const edit = readPhoneEdit({
      raw: "3412 345 67",
      caret: 2,
      previousDisplay: "34 12 345 67",
      inputType,
      countryCode: CODE,
    });

    expect(edit).toEqual({ digits, caretDigits: caret });
  });

  it("does not remove another digit when a digit itself was deleted", () => {
    const edit = readPhoneEdit({
      raw: "34 1 345 67",
      caret: 4,
      previousDisplay: "34 12 345 67",
      inputType: "deleteContentBackward",
      countryCode: CODE,
    });

    expect(edit.digits).toBe("34134567");
  });

  it("finds the position after a count of digits, skipping the spaces before it", () => {
    expect(caretAfterDigits("34 12 345 67", 0)).toBe(0);
    expect(caretAfterDigits("34 12 345 67", 2)).toBe(2);
    expect(caretAfterDigits("34 12 345 67", 3)).toBe(4);
  });
});

describe("the check of the phone field", () => {
  it("accepts a number of the plan", () => {
    expect(checkPhone("34 12 345 67", CODE)).toEqual({ ok: true });
  });

  it.each([
    ["missing digits", "34 12", "missing_digits"],
    ["a prefix that is not an operator's", "31 12 345 67", "invalid_prefix"],
    ["nothing", "", "invalid"],
  ])("tells %s", (_label, display, issue) => {
    expect(checkPhone(display, CODE)).toEqual({ ok: false, issue });
  });

  it("gives the generic issue for another refusal, such as a number of a country without a rule", () => {
    expect(checkPhone("06 12 34 56 78", "33")).toEqual({ ok: false, issue: "invalid" });
  });
});
