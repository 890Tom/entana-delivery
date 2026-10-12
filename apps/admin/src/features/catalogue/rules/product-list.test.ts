import { describe, expect, it } from "vitest";

import { buildProduct } from "../../../test-support/catalogue/build-product";

import { activeIdsOf, replaceProduct, withActiveOrder } from "./product-list";

const first = buildProduct(1);
const second = buildProduct(2);
const third = buildProduct(3);
const retired = buildProduct(4, { retired: true });

describe("the product list", () => {
  it("lists the ids of the active products in display order", () => {
    expect(activeIdsOf([first, retired, second])).toEqual([first.id, second.id]);
  });

  it("applies a new order to the active products and keeps the retired ones after them", () => {
    const next = withActiveOrder([first, second, third, retired], [third.id, first.id, second.id]);
    expect(next.map((product) => product.id)).toEqual([third.id, first.id, second.id, retired.id]);
    expect(next.slice(0, 3).map((product) => product.position)).toEqual([0, 1, 2]);
  });

  it("replaces a product by the one the server answered, and sorts by position", () => {
    const restored = { ...retired, retired: false, position: 9 };
    const next = replaceProduct([first, second, retired], restored);
    expect(next.map((product) => product.id)).toEqual([first.id, second.id, retired.id]);
    expect(next.at(-1)?.retired).toBe(false);
  });

  it("ignores an id that is not in the list", () => {
    const next = withActiveOrder([first, second], [second.id, "unknown", first.id]);
    expect(next.map((product) => product.id)).toEqual([second.id, first.id]);
  });
});
