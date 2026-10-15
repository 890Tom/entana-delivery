import { describe, expect, it } from "vitest";

import { texts } from "../../../i18n/texts";

import { SIGNED_IN_SCREENS } from "./signed-in-screens";

describe("the screens of a signed-in person", () => {
  it("each declare a title", () => {
    expect(SIGNED_IN_SCREENS.filter(({ title }) => title.trim() === "")).toStrictEqual([]);
  });

  it("never share a title, with each other, the sign-in or the not found page", () => {
    const titles = [
      texts.login.title,
      texts.notFound.title,
      ...SIGNED_IN_SCREENS.map(({ title }) => title),
    ];

    expect(new Set(titles).size).toBe(titles.length);
  });
});
