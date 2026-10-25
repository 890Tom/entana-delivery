import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GARE_ROUTIERE_FEATURES,
  buildPhotonCollection,
  buildPhotonFeature,
  respondWith,
} from "../../../tests/support/photon-response.js";
import { PlaceSearchUnavailableError } from "../errors/place-search-errors.js";
import { PHOTON_TIMEOUT_MS, PhotonPlaceSearch } from "./photon-place-search.js";

const NEAR = { lat: -18.91, lng: 47.52 };
const TEXT = "gare routiere";

function stubFetch(implementation: (url: URL, init: RequestInit) => Promise<Response>): void {
  vi.stubGlobal("fetch", vi.fn(implementation));
}

function search(): ReturnType<PhotonPlaceSearch["search"]> {
  return new PhotonPlaceSearch().search(TEXT, NEAR);
}

// A fetch that never answers and rejects when its request is aborted, as the real one does.
function hangUntilAborted(_url: URL, init: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    });
  });
}

describe("PhotonPlaceSearch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reads the real answer of Photon: label, point as { lat, lng } and country", async () => {
    stubFetch(() => Promise.resolve(respondWith(buildPhotonCollection(GARE_ROUTIERE_FEATURES))));

    const candidates = await search();

    expect(candidates).toHaveLength(10);
    expect(candidates[0]).toStrictEqual({
      label: "Gare Routière du Sud, Rue du Pasteur Rahajason, Antananarivo",
      lat: -18.92443,
      lng: 47.5138169,
      countryCode: "MG",
    });
  });

  it("builds the label without a null street, and keeps a place outside Antananarivo", async () => {
    stubFetch(() => Promise.resolve(respondWith(buildPhotonCollection(GARE_ROUTIERE_FEATURES))));

    const labels = (await search()).map((candidate) => candidate.label);

    expect(labels[3]).toBe("Gare routière Ampasampito, Antananarivo");
    expect(labels[6]).toBe("Gare routière SOATRANS AMBATOLAMPY, Ambatolampy");
  });

  it("drops an empty or repeated part of the label, and a place without a label", async () => {
    const features = [
      buildPhotonFeature([47.5, -18.9], { name: "Analakely", street: " ", city: "Analakely" }),
      buildPhotonFeature([47.5, -18.9], { name: null, city: "" }),
    ];
    stubFetch(() => Promise.resolve(respondWith(buildPhotonCollection(features))));

    const labels = (await search()).map((candidate) => candidate.label);

    expect(labels).toEqual(["Analakely"]);
  });

  it("drops an invalid feature and keeps the valid ones around it", async () => {
    const [first, , third] = GARE_ROUTIERE_FEATURES;
    const invalid = { type: "Feature", geometry: { type: "Point" }, properties: {} };
    stubFetch(() => Promise.resolve(respondWith(buildPhotonCollection([first, invalid, third]))));

    const labels = (await search()).map((candidate) => candidate.label);

    expect(labels).toEqual([
      "Gare Routière du Sud, Rue du Pasteur Rahajason, Antananarivo",
      "Gare Routière Maki, RN4, Rocade Andohatapenaka, Antananarivo",
    ]);
  });

  it("asks Photon for 10 places in French near the given point, with the text", async () => {
    let requested: URL | undefined;
    stubFetch((url) => {
      requested = url;
      return Promise.resolve(respondWith(buildPhotonCollection([])));
    });

    await search();

    expect(requested?.href.split("?")[0]).toBe("https://photon.komoot.io/api/");
    expect(Object.fromEntries(requested?.searchParams ?? [])).toEqual({
      q: TEXT,
      lat: "-18.91",
      lon: "47.52",
      limit: "10",
      lang: "fr",
    });
  });

  it.each([
    ["a network error", (): Promise<Response> => Promise.reject(new TypeError("fetch failed"))],
    ["a status other than 2xx", (): Promise<Response> => Promise.resolve(respondWith({}, 502))],
    [
      "a body that is not JSON",
      (): Promise<Response> => Promise.resolve(new Response("<html>", { status: 200 })),
    ],
    [
      "a body without features",
      (): Promise<Response> => Promise.resolve(respondWith({ type: "FeatureCollection" })),
    ],
  ])("fails as unavailable on %s", async (_name, answer) => {
    stubFetch(answer);

    await expect(search()).rejects.toThrow(PlaceSearchUnavailableError);
  });

  it("fails as unavailable when Photon has not answered after 3 seconds", async () => {
    vi.useFakeTimers();
    stubFetch(hangUntilAborted);

    const pending = search();
    const outcome = expect(pending).rejects.toThrow(PlaceSearchUnavailableError);
    await vi.advanceTimersByTimeAsync(PHOTON_TIMEOUT_MS);

    await outcome;
    expect(PHOTON_TIMEOUT_MS).toBe(3_000);
  });
});
