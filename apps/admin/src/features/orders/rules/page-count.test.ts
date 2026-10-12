import { describe, expect, it } from "vitest";

import { countPages } from "./page-count";

describe("countPages", () => {
  it.each([
    [0, 25, 1],
    [1, 25, 1],
    [25, 25, 1],
    [26, 25, 2],
    [100, 25, 4],
  ])("counts %d orders at %d a page as %d pages", (total, size, pages) => {
    expect(countPages(total, size)).toBe(pages);
  });
});
