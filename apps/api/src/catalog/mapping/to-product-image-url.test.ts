import { describe, expect, it } from "vitest";
import { InvalidProductImageKeyError } from "../errors/invalid-product-image-key-error.js";
import { toProductImageUrl } from "./to-product-image-url.js";

describe("toProductImageUrl", () => {
  it("builds the media URL of a valid file name", () => {
    expect(toProductImageUrl("zebu-skewers.jpg")).toBe("/media/products/zebu-skewers.jpg");
  });

  it("gives no URL for a null key", () => {
    expect(toProductImageUrl(null)).toBeNull();
  });

  it.each([
    ["a path separator", "products/zebu.jpg"],
    ["a svg extension", "zebu.svg"],
    ["a double dot", "zebu..jpg"],
    ["the jpeg extension", "zebu.jpeg"],
  ])(
    "throws the typed error for a key with %s, with a message that holds no key",
    (_label, key) => {
      const failure = ((): unknown => {
        try {
          toProductImageUrl(key);
        } catch (error) {
          return error;
        }
        return undefined;
      })();

      expect(failure).toBeInstanceOf(InvalidProductImageKeyError);
      expect(failure instanceof Error ? failure.message : "").not.toContain(key);
    },
  );
});
