import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildPhotonCollection, respondWith } from "../support/photon-response.js";
import { startRealApp } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

const SEARCH_PATH = "/api/v1/places/search";
// Distinctive: found in a log only if the searched text was written there.
const SEARCHED_TEXT = "gare routiere zq7";

describe("GET /api/v1/places/search: the limit per address", () => {
  const logs = captureLogs();
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startRealApp(buildTestConfig({ LOG_LEVEL: "info" }), logs.stream);
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers 429 with Retry-After to the 61st request of an address, before Photon", async () => {
    // No request ever leaves the machine.
    const photon = vi.fn(() => Promise.resolve(respondWith(buildPhotonCollection([]))));
    vi.stubGlobal("fetch", photon);
    const search = (): request.Test =>
      request(app.getHttpServer()).get(SEARCH_PATH).query({ q: SEARCHED_TEXT });
    for (let attempt = 0; attempt < 60; attempt += 1) {
      expect((await search()).status).toBe(200);
    }

    const response = await search();

    expect(response.status).toBe(429);
    expect(photon).toHaveBeenCalledTimes(60);
    expect(response.headers["retry-after"]).toBe("600");
    expect(response.body).toMatchObject({ status: 429, instance: SEARCH_PATH });
    expect(logs.text()).toContain("places_search_address_limited");
    expect(logs.text()).not.toContain("zq7");
  });
});
