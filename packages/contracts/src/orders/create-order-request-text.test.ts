import { describe, expect, it } from "vitest";
import { createOrderRequestSchema } from "./create-order-request.js";
import {
  FIRST_PRODUCT_ID,
  buildRequest,
  isAccepted,
  issueMessages,
  rejectedFields,
  rejectedPaths,
} from "./test-support/create-order-request-builder.js";

const INVISIBLE_CHARACTER_MESSAGE = "must not contain an invisible or text-direction character";

const FORMAT_CHARACTERS: readonly (readonly [string, string])[] = [
  ["U+202E right-to-left override", "\u202E"],
  ["U+2066 left-to-right isolate", "\u2066"],
  ["U+200B zero-width space", "\u200B"],
  ["U+200C zero-width non-joiner", "\u200C"],
  ["U+200D zero-width joiner", "\u200D"],
  ["U+2060 word joiner", "\u2060"],
  ["U+FEFF byte order mark", "\uFEFF"],
  ["U+2028 line separator", "\u2028"],
  ["U+2029 paragraph separator", "\u2029"],
];

const FREE_TEXT_FIELDS = ["contactName", "landmarkText", "customerNote"] as const;

// JSON.parse creates "__proto__" as an own property, which an object literal cannot.
const parseJsonObject = (text: string): object => {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) {
    throw new TypeError("expected a JSON object");
  }
  return parsed;
};

describe("createOrderRequestSchema free text", () => {
  describe("invisible and text-direction characters", () => {
    const cases = FREE_TEXT_FIELDS.flatMap((field) => {
      return FORMAT_CHARACTERS.map(([label, character]) => [field, label, character] as const);
    });

    it.each(cases)("rejects %s containing %s", (field, _label, character) => {
      const request = buildRequest({ [field]: `Rakoto${character}Andry` });
      expect(rejectedPaths(request)).toEqual([field]);
      expect(issueMessages(request)).toEqual([INVISIBLE_CHARACTER_MESSAGE]);
    });

    it("reports one invisible-character issue for a note that also has a newline", () => {
      const request = buildRequest({ customerNote: "a\n\u202Eb" });
      expect(rejectedPaths(request)).toEqual(["customerNote"]);
      expect(issueMessages(request)).toEqual([INVISIBLE_CHARACTER_MESSAGE]);
    });

    it("reports both problems, control character first, when a name has both", () => {
      const request = buildRequest({ contactName: "a\u0000\u202Eb" });
      expect(issueMessages(request)).toEqual([
        "must not contain a control character",
        INVISIBLE_CHARACTER_MESSAGE,
      ]);
    });

    it("rejects a name made only of zero-width spaces", () => {
      expect(rejectedPaths(buildRequest({ contactName: "\u200B\u200B" }))).toEqual(["contactName"]);
    });

    it("rejects a composed emoji, because the zero-width joiner is refused", () => {
      const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
      expect(rejectedPaths(buildRequest({ contactName: family }))).toEqual(["contactName"]);
    });

    it("still accepts a newline in the customer note, but not in the other fields", () => {
      expect(isAccepted(buildRequest({ customerNote: "a\nb" }))).toBe(true);
      expect(rejectedPaths(buildRequest({ contactName: "a\nb" }))).toEqual(["contactName"]);
    });
  });

  describe("an own __proto__ key", () => {
    it("is rejected by the strict schema and never reaches Object.prototype", () => {
      const body = parseJsonObject(
        `{"__proto__":{"polluted":true},"phone":"034 12 345 67","contactName":"Rakoto",` +
          `"landmarkText":"pharmacie","location":{"lat":0,"lng":0},` +
          `"items":[{"productId":"${FIRST_PRODUCT_ID}","quantity":1}]}`,
      );
      expect(Object.keys(body)).toContain("__proto__");
      expect(rejectedPaths(body)).toEqual([""]);
      expect("polluted" in {}).toBe(false);
    });
  });

  describe("error reports", () => {
    const secretCases: readonly (readonly [string, string, unknown])[] = [
      ["phone", "ZQX-PHONE-9902", "ZQX-PHONE-9902"],
      ["contactName", "ZQX-NAME-4417", "ZQX-NAME-4417\u202E"],
      ["landmarkText", "ZQX-LANDMARK-5530", "ZQX-LANDMARK-5530\u2028"],
      ["customerNote", "ZQX-NOTE-1186", "ZQX-NOTE-1186\u202E"],
      ["location", "8123.456", { lat: 8123.456, lng: 0 }],
    ];

    it.each(secretCases)("never repeats the rejected %s", (field, secret, value) => {
      const request = buildRequest({ [field]: value });
      expect(rejectedFields(request)).toEqual([field]);
      const report = JSON.stringify(createOrderRequestSchema.safeParse(request));
      expect(report).not.toContain(secret);
      expect(report).not.toContain("\u202E");
      expect(report).not.toContain("\u2028");
    });
  });
});
