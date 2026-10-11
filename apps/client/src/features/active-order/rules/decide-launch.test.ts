import { describe, expect, it } from "vitest";

import { shouldCheckLaunch } from "./decide-launch";

const FIRST_OPENING = { isHandled: false, path: "/", hasOrder: true, isCartEmpty: true };

describe("checking the opening of the application", () => {
  it("is made at the first opening of a session on the catalogue, with an order and no cart", () => {
    expect(shouldCheckLaunch(FIRST_OPENING)).toBe(true);
  });

  it.each([
    ["the session already handled its opening", { isHandled: true }],
    ["the application opens on another address", { path: "/panier" }],
    ["the device remembers no order", { hasOrder: false }],
    ["the cart is not empty", { isCartEmpty: false }],
  ])("is not made when %s", (_reason, change) => {
    expect(shouldCheckLaunch({ ...FIRST_OPENING, ...change })).toBe(false);
  });
});
