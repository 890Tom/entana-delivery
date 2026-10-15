import { describe, expect, it } from "vitest";

import { buildDocumentTitle } from "./build-document-title";

describe("buildDocumentTitle", () => {
  it("names the screen, the administration, then the shop", () => {
    expect(buildDocumentTitle("Commandes", "Maison Démo")).toBe(
      "Commandes — Administration — Maison Démo",
    );
  });

  it("leaves the shop out while its name is not known", () => {
    expect(buildDocumentTitle("Commandes", null)).toBe("Commandes — Administration");
  });

  it("names only the administration when no screen is shown", () => {
    expect(buildDocumentTitle(null, null)).toBe("Administration");
  });
});
