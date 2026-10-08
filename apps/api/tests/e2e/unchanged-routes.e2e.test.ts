import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { observeUnchangedRoutes } from "./support/observe-unchanged-routes.js";
import type { ObservedRoutes } from "./support/observe-unchanged-routes.js";

// Golden answers of the routes that validation errors must not change. To refresh them after a
// deliberate change, write the result of `observeUnchangedRoutes()` to the fixture.
const EXPECTED: ObservedRoutes = JSON.parse(
  readFileSync(new URL("fixtures/unchanged-routes.json", import.meta.url), "utf8"),
) as ObservedRoutes; // The fixture is written by this repository's own helper.

describe("routes other than validation", () => {
  let observed: ObservedRoutes;

  beforeAll(async () => {
    observed = await observeUnchangedRoutes();
  });

  it.each(Object.keys(EXPECTED))("answers %s exactly as before", (route) => {
    expect(observed[route]).toEqual(EXPECTED[route]);
  });
});
