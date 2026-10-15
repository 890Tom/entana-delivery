import { describe, expect, it } from "vitest";

import manifestText from "../../public/manifest.webmanifest?raw";

// Listed, never loaded: only the names of the files in public/icons matter here.
const PUBLIC_ICON_FILES = Object.keys(import.meta.glob("../../public/icons/*.png"));

const MANIFEST_ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
] as const;

function parseManifest(): unknown {
  return JSON.parse(manifestText);
}

describe("the web app manifest", () => {
  it("is valid JSON", () => {
    expect(parseManifest).not.toThrow();
  });

  it("declares a standalone French app from the root, without an orientation lock", () => {
    expect(parseManifest()).toEqual({
      name: "Entana Delivery",
      short_name: "Entana",
      lang: "fr",
      start_url: "/",
      scope: "/",
      display: "standalone",
      // --color-surface of tokens.css: the page and the sticky header.
      theme_color: "#ffffff",
      background_color: "#ffffff",
      icons: MANIFEST_ICONS,
    });
  });

  it.each(MANIFEST_ICONS)("references $src, a file of public/", ({ src }) => {
    expect(PUBLIC_ICON_FILES).toContain(`../../public${src}`);
  });
});
