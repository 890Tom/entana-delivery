import { describe, expect, it } from "vitest";

import { isProductPhotoRequest, PWA_OPTIONS } from "./pwa-config";

const ORIGIN = "https://shop.example";
const PHOTO_ID = "0b7c6d2e-4f1a-4c3b-9d8e-1a2b3c4d5e6f";
const PHOTO_PATH = `/media/products/${PHOTO_ID}.webp`;

function isCachedPhoto(path: string, origin = ORIGIN): boolean {
  return isProductPhotoRequest({ url: new URL(path, origin), sameOrigin: origin === ORIGIN });
}

function isNavigationFallbackDenied(path: string): boolean {
  const denylist = PWA_OPTIONS.workbox?.navigateFallbackDenylist ?? [];
  return denylist.some((pattern) => pattern.test(path));
}

describe("the service worker configuration", () => {
  it("never answers a navigation to /api or /media with the cached page", () => {
    expect(isNavigationFallbackDenied("/api/v1/products")).toBe(true);
    expect(isNavigationFallbackDenied("/media/branding/logo.png")).toBe(true);
    expect(isNavigationFallbackDenied("/livraison")).toBe(false);
  });

  it("has a single runtime cache rule, the product photos", () => {
    const rules = PWA_OPTIONS.workbox?.runtimeCaching ?? [];

    expect(rules.map((rule) => rule.urlPattern)).toEqual([isProductPhotoRequest]);
  });

  it("caches an uploaded product photo of its own origin", () => {
    expect(isCachedPhoto(PHOTO_PATH)).toBe(true);
  });

  it.each([
    ["a branding file", "/media/branding/logo.png"],
    ["an API answer", "/api/v1/products"],
    ["a product file placed by hand", "/media/products/placeholder-alpha.png"],
    ["a photo name in uppercase", `/media/products/${PHOTO_ID.toUpperCase()}.webp`],
  ])("does not cache %s", (_case, path) => {
    expect(isCachedPhoto(path)).toBe(false);
  });

  it("does not cache a photo of another origin", () => {
    expect(isCachedPhoto(PHOTO_PATH, "https://other.example")).toBe(false);
  });
});
