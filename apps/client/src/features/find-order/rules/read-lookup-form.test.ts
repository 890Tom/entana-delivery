import { describe, expect, it } from "vitest";

import { readOrderCode, toLookupRequest } from "./read-lookup-form";

describe("reading an order code", () => {
  it.each([
    ["k7m2qx", "K7M2QX"],
    [" k7m-2 qx ", "K7M2QX"],
  ])("makes the canonical code of %j", (typed, expected) => {
    expect(readOrderCode(typed)).toBe(expected);
  });

  it.each([["K7M2Q"], ["K7M2QXX"], ["K7M2Q0"], [""]])("refuses %j", (typed) => {
    expect(readOrderCode(typed)).toBeNull();
  });
});

describe("the request of the lookup", () => {
  it("holds the canonical phone number and the canonical code", () => {
    expect(toLookupRequest("34 12 345 67", "k7m-2qx", "261")).toStrictEqual({
      phone: "+261341234567",
      orderCode: "K7M2QX",
    });
  });

  it("is absent while the number is not valid", () => {
    expect(toLookupRequest("34 12", "K7M2QX", "261")).toBeNull();
  });

  it("is absent while the code is not valid", () => {
    expect(toLookupRequest("34 12 345 67", "K7M2", "261")).toBeNull();
  });
});
