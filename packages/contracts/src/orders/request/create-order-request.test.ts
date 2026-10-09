import { describe, expect, it } from "vitest";
import { createOrderRequestSchema } from "./create-order-request.js";
import {
  FIRST_PRODUCT_ID,
  SECOND_PRODUCT_ID,
  buildRequest,
  isAccepted,
  issueCodes,
  rejectedFields,
  rejectedPaths,
} from "./test-support/create-order-request-builder.js";

const without = (field: string): Record<string, unknown> => {
  return Object.fromEntries(Object.entries(buildRequest()).filter(([key]) => key !== field));
};

const uuidAt = (index: number): string => {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
};

const itemsOfLength = (count: number): unknown[] => {
  return Array.from({ length: count }, (_unused, index) => ({
    productId: uuidAt(index),
    quantity: 1,
  }));
};

describe("createOrderRequestSchema", () => {
  describe("a complete request", () => {
    it("is accepted and returned unchanged", () => {
      const request = buildRequest();
      expect(createOrderRequestSchema.parse(request)).toEqual(request);
    });

    it("does not transform the phone number, the name or the landmark", () => {
      const request = buildRequest({
        phone: " (034) 12-345.67 ",
        contactName: "  Rakoto  ",
        landmarkText: "  pharmacie  ",
      });
      expect(createOrderRequestSchema.parse(request)).toMatchObject({
        phone: " (034) 12-345.67 ",
        contactName: "  Rakoto  ",
        landmarkText: "  pharmacie  ",
      });
    });

    it("accepts a request without a customer note", () => {
      expect(isAccepted(without("customerNote"))).toBe(true);
    });
  });

  describe("required fields", () => {
    it.each(["phone", "trackingToken", "contactName", "landmarkText", "location", "items"])(
      "rejects a request without %s",
      (field) => {
        expect(rejectedPaths(without(field))).toEqual([field]);
      },
    );

    it.each([null, 12, []])("rejects a request that is %j", (value) => {
      expect(rejectedPaths(value)).toEqual([""]);
    });

    it("rejects an empty object for every required field", () => {
      expect(rejectedPaths({})).toEqual([
        "phone",
        "trackingToken",
        "contactName",
        "landmarkText",
        "location",
        "items",
      ]);
    });
  });

  describe("phone", () => {
    it.each([
      ["1 character", "0"],
      ["32 characters", "+261 34 12 345 67".padEnd(32, " ")],
      ["every allowed separator", "+(034) 12-345.67"],
    ])("accepts %s", (_label, phone) => {
      expect(isAccepted(buildRequest({ phone }))).toBe(true);
    });

    it.each([
      ["an empty string", ""],
      ["33 characters", "1".repeat(33)],
      ["letters", "034 12 345 6a"],
      ["a tab", "034\t12"],
      ["a non-breaking space", "034\u00A012"],
      ["a number", 341234567],
    ])("rejects %s", (_label, phone) => {
      expect(rejectedPaths(buildRequest({ phone }))).toEqual(["phone"]);
    });

    it("rejects a 1 MB phone string on its length alone", () => {
      expect(issueCodes(buildRequest({ phone: "x".repeat(1_000_000) }))).toEqual(["too_big"]);
    });

    it("checks the length before the pattern, so an oversized string reports only its length", () => {
      expect(issueCodes(buildRequest({ phone: "x".repeat(1_000) }))).toEqual(["too_big"]);
    });
  });

  describe("contactName", () => {
    it.each([
      ["1 character", "R"],
      ["80 characters", "a".repeat(80)],
      ["an accented name", "Rakotoarivélo Hérinjaka"],
      ["a Malagasy name", "Andrianampoinimerina Rasoanirina"],
      ["a plain emoji", "Rakoto 😀"],
      ["a combining character, counted as 2 code points", "e\u0301"],
      ["80 emoji, counted as 80 code points", "😀".repeat(80)],
      ["40 accented letters, counted as 80 code points", "e\u0301".repeat(40)],
    ])("accepts %s", (_label, contactName) => {
      expect(isAccepted(buildRequest({ contactName }))).toBe(true);
    });

    it.each([
      ["an empty string", ""],
      ["spaces only", "   "],
      ["81 characters", "a".repeat(81)],
      ["81 emoji, counted as 81 code points", "😀".repeat(81)],
      ["40 accented letters and one more character, 81 code points", `${"e\u0301".repeat(40)}a`],
      ["a newline", "Rakoto\nAndry"],
      ["a null character", "Rakoto\u0000"],
      ["a tab", "Rakoto\tAndry"],
      ["a C1 control character", "Rakoto\u0085"],
      ["a delete character", "Rakoto\u007F"],
    ])("rejects %s", (_label, contactName) => {
      expect(rejectedPaths(buildRequest({ contactName }))).toEqual(["contactName"]);
    });

    it("checks the length before the pattern, so an oversized blank string reports only its length", () => {
      expect(issueCodes(buildRequest({ contactName: " ".repeat(1_000) }))).toEqual(["too_big"]);
    });
  });

  describe("customerNote", () => {
    it("checks the length before the pattern, so an oversized invisible string reports only its length", () => {
      expect(issueCodes(buildRequest({ customerNote: "\u202E".repeat(1_000) }))).toEqual([
        "too_big",
      ]);
    });

    it.each([
      ["1 character", "x"],
      ["300 characters", "a".repeat(300)],
      ["an empty string", ""],
      ["a newline", "Portail bleu\nsonner deux fois"],
    ])("accepts %s", (_label, customerNote) => {
      expect(isAccepted(buildRequest({ customerNote }))).toBe(true);
    });

    it.each([
      ["301 characters", "a".repeat(301)],
      ["a null character", "note\u0000"],
      ["a tab", "note\tnote"],
      ["a carriage return", "note\rnote"],
      ["an escape character", "note\u001B[0m"],
      ["a number", 12],
      ["null", null],
    ])("rejects %s", (_label, customerNote) => {
      expect(rejectedPaths(buildRequest({ customerNote }))).toEqual(["customerNote"]);
    });
  });

  describe("landmarkText", () => {
    it("checks the length before the pattern, so an oversized blank string reports only its length", () => {
      expect(issueCodes(buildRequest({ landmarkText: " ".repeat(1_000) }))).toEqual(["too_big"]);
    });

    it.each([
      ["1 character", "x"],
      ["200 characters", "a".repeat(200)],
    ])("accepts %s", (_label, landmarkText) => {
      expect(isAccepted(buildRequest({ landmarkText }))).toBe(true);
    });

    it.each([
      ["an empty string", ""],
      ["spaces only", "  \u3000 "],
      ["201 characters", "a".repeat(201)],
      ["a newline", "pharmacie\nAnkorondrano"],
      ["a null character", "pharmacie\u0000"],
    ])("rejects %s", (_label, landmarkText) => {
      expect(rejectedPaths(buildRequest({ landmarkText }))).toEqual(["landmarkText"]);
    });
  });

  describe("location", () => {
    it.each([
      ["a point in Antananarivo", { lat: -18.8792, lng: 47.5079 }],
      ["the origin", { lat: 0, lng: 0 }],
      ["the south-west corner", { lat: -90, lng: -180 }],
      ["the north-east corner", { lat: 90, lng: 180 }],
    ])("accepts %s", (_label, location) => {
      expect(isAccepted(buildRequest({ location }))).toBe(true);
    });

    it.each([
      ["null", null],
      ["an empty object", {}],
      ["only lat", { lat: -18.8 }],
      ["only lng", { lng: 47.5 }],
      ["a latitude above 90", { lat: 90.0001, lng: 0 }],
      ["a latitude below -90", { lat: -90.0001, lng: 0 }],
      ["a longitude above 180", { lat: 0, lng: 180.0001 }],
      ["a longitude below -180", { lat: 0, lng: -180.0001 }],
      ["a NaN latitude", { lat: Number.NaN, lng: 0 }],
      ["an infinite longitude", { lat: 0, lng: Number.POSITIVE_INFINITY }],
      ["numeric strings", { lat: "-18.8", lng: "47.5" }],
      ["an extra property", { lat: 0, lng: 0, accuracy: 10 }],
      ["an array", [-18.8, 47.5]],
      ["a string", "-18.8,47.5"],
    ])("rejects %s", (_label, location) => {
      expect(rejectedFields(buildRequest({ location }))).toEqual(["location"]);
    });

    it("rejects a missing location", () => {
      expect(rejectedPaths(without("location"))).toEqual(["location"]);
    });
  });

  describe("items", () => {
    it.each([1, 30])("accepts %i items", (count) => {
      expect(isAccepted(buildRequest({ items: itemsOfLength(count) }))).toBe(true);
    });

    it.each([0, 31])("rejects %i items", (count) => {
      expect(rejectedPaths(buildRequest({ items: itemsOfLength(count) }))).toEqual(["items"]);
    });

    it.each([1, 50, 99])("accepts a quantity of %i", (quantity) => {
      expect(isAccepted(buildRequest({ items: [{ productId: FIRST_PRODUCT_ID, quantity }] }))).toBe(
        true,
      );
    });

    it.each([0, 100, -1, 1.5, Number.NaN, "2", null])("rejects a quantity of %j", (quantity) => {
      const items = [{ productId: FIRST_PRODUCT_ID, quantity }];
      expect(rejectedPaths(buildRequest({ items }))).toEqual(["items.0.quantity"]);
    });

    it("rejects a product id that is not a uuid", () => {
      const items = [{ productId: "not-a-uuid", quantity: 1 }];
      expect(rejectedPaths(buildRequest({ items }))).toEqual(["items.0.productId"]);
    });

    it("rejects the same product twice", () => {
      const items = [
        { productId: FIRST_PRODUCT_ID, quantity: 1 },
        { productId: SECOND_PRODUCT_ID, quantity: 1 },
        { productId: FIRST_PRODUCT_ID, quantity: 3 },
      ];
      expect(rejectedPaths(buildRequest({ items }))).toEqual(["items"]);
    });

    it("accepts two different products", () => {
      const items = [
        { productId: FIRST_PRODUCT_ID, quantity: 1 },
        { productId: SECOND_PRODUCT_ID, quantity: 1 },
      ];
      expect(isAccepted(buildRequest({ items }))).toBe(true);
    });

    it.each([
      ["a quantity", { productId: FIRST_PRODUCT_ID }, "items.0.quantity"],
      ["a product id", { quantity: 1 }, "items.0.productId"],
    ])("rejects an item without %s", (_label, item, path) => {
      expect(rejectedPaths(buildRequest({ items: [item] }))).toEqual([path]);
    });

    it("rejects the same product written in upper and lower case", () => {
      const items = [
        { productId: FIRST_PRODUCT_ID, quantity: 1 },
        { productId: FIRST_PRODUCT_ID.toUpperCase(), quantity: 1 },
      ];
      expect(rejectedPaths(buildRequest({ items }))).toEqual(["items"]);
    });

    it("rejects a price inside an item", () => {
      const items = [{ productId: FIRST_PRODUCT_ID, quantity: 1, unitPrice: 1 }];
      expect(rejectedPaths(buildRequest({ items }))).toEqual(["items.0"]);
    });
  });

  describe("properties the client must not send", () => {
    it.each(["price", "total", "totalAr", "deliveryFee", "status", "customerId", "extra"])(
      "rejects a %s property",
      (property) => {
        expect(rejectedPaths(buildRequest({ [property]: 1 }))).toEqual([""]);
      },
    );
  });
});
