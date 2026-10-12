import { describe, expect, it } from "vitest";

import page from "../index.html?raw";

describe("index.html", () => {
  it("asks robots not to index nor follow, with no script involved", () => {
    expect(page).toContain('<meta name="robots" content="noindex, nofollow" />');
  });
});
