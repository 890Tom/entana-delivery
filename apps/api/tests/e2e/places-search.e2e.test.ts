import type { InstanceConfig } from "@entana/contracts";
import { PLACE_PROBLEM_TYPES, placeSearchResponseSchema } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { INSTANCE_CONFIG } from "../../src/instance/config-token/instance-config.token.js";
import {
  FOREIGN_FEATURE,
  GARE_ROUTIERE_FEATURES,
  buildPhotonCollection,
  respondWith,
} from "../support/photon-response.js";
import { startRealApp } from "./support/create-test-app.js";
import { captureLogs } from "./support/log-capture.js";
import { buildTestConfig } from "./support/test-config.js";

const SEARCH_PATH = "/api/v1/places/search";
// Distinctive: found in a log only if the searched text was written there.
const SEARCHED_TEXT = "gare routiere zq7";

type FetchDouble = ReturnType<typeof vi.fn<(url: URL) => Promise<Response>>>;

// Every test replaces `fetch`: no request ever leaves the machine.
function stubPhoton(answer: () => Promise<Response>): FetchDouble {
  const double = vi.fn<(url: URL) => Promise<Response>>(answer);
  vi.stubGlobal("fetch", double);
  return double;
}

function answerGareRoutiere(): Promise<Response> {
  const [first, second, ...rest] = GARE_ROUTIERE_FEATURES;
  return Promise.resolve(
    respondWith(buildPhotonCollection([first, FOREIGN_FEATURE, second, ...rest])),
  );
}

describe("the HTTP contract of GET /api/v1/places/search", () => {
  const logs = captureLogs();
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await startRealApp(buildTestConfig({ LOG_LEVEL: "info" }), logs.stream);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    logs.reset();
    stubPhoton(() => Promise.reject(new Error("Photon was not set up by this test.")));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const search = (query: Record<string, string>): request.Test =>
    request(app.getHttpServer()).get(SEARCH_PATH).query(query);

  it("answers the first 5 places of Madagascar in the order of Photon, never stored", async () => {
    stubPhoton(answerGareRoutiere);

    const response = await search({ q: SEARCHED_TEXT });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(placeSearchResponseSchema.parse(response.body).suggestions).toStrictEqual([
      {
        label: "Gare Routière du Sud, Rue du Pasteur Rahajason, Antananarivo",
        lat: -18.92443,
        lng: 47.5138169,
      },
      {
        label: "Gare routière MAKI, Route de la Digue, Antananarivo",
        lat: -18.8980441,
        lng: 47.4959614,
      },
      {
        label: "Gare Routière Maki, RN4, Rocade Andohatapenaka, Antananarivo",
        lat: -18.8975663,
        lng: 47.4958183,
      },
      { label: "Gare routière Ampasampito, Antananarivo", lat: -18.8938177, lng: 47.5487896 },
      {
        label: "Gare routière FICOTRANS Ankadimbahoaka, Antananarivo",
        lat: -18.9454006,
        lng: 47.524607,
      },
    ]);
  });

  it("asks Photon near the map centre of the instance, for 10 places in French", async () => {
    const photon = stubPhoton(answerGareRoutiere);
    const { center } = app.get<symbol, InstanceConfig>(INSTANCE_CONFIG).map;

    await search({ q: SEARCHED_TEXT });

    const params = photon.mock.calls[0]?.[0].searchParams;
    expect(params?.get("lat")).toBe(String(center.lat));
    expect(params?.get("lon")).toBe(String(center.lng));
    expect(params?.get("limit")).toBe("10");
    expect(params?.get("lang")).toBe("fr");
  });

  it.each([
    ["a text of 2 characters", { q: "ab" }],
    ["a text of 101 characters", { q: "a".repeat(101) }],
    ["an unknown parameter", { q: SEARCHED_TEXT, lat: "-18.9" }],
  ])("answers 400 problem+json for %s, without asking Photon", async (_name, query) => {
    const photon = stubPhoton(answerGareRoutiere);

    const response = await search(query);

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: "urn:entana:problem:validation-error",
      status: 400,
    });
    expect(photon).not.toHaveBeenCalled();
  });

  it("answers 503 with the stable type when Photon fails, and logs no searched text", async () => {
    stubPhoton(() => Promise.reject(new TypeError("fetch failed")));

    const response = await search({ q: SEARCHED_TEXT });

    expect(response.status).toBe(503);
    expect(response.headers["content-type"]).toMatch(/^application\/problem\+json/);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toStrictEqual({
      type: PLACE_PROBLEM_TYPES.searchUnavailable,
      title: "Service Unavailable",
      status: 503,
      detail: "The place search is not available. Try again later.",
      instance: SEARCH_PATH,
    });
    expect(logs.entries().length).toBeGreaterThan(0);
    expect(logs.text()).not.toContain("zq7");
    expect(logs.text()).not.toContain("fetch failed");
  });

  it("is documented in OpenAPI", async () => {
    const response = await request(app.getHttpServer()).get("/api/docs-json");
    const document = JSON.parse(response.text) as {
      paths: Record<string, { get?: { operationId?: string } }>;
    }; // The document is written by the application's own Swagger setup.

    expect(document.paths[SEARCH_PATH]?.get?.operationId).toBe("searchPlaces");
  });
});
