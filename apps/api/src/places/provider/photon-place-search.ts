import { Injectable } from "@nestjs/common";
import { placeSuggestionSchema } from "@entana/contracts";
import { z } from "zod";
import { PlaceSearchUnavailableError } from "../errors/place-search-errors.js";
import type { PlaceCandidate } from "../rules/select-suggestions.js";

// The public instance of Photon (https://photon.komoot.io), no key and no account. The only
// file that knows the provider.
const PHOTON_BASE_URL = "https://photon.komoot.io/api/";
/** How long the whole call (answer and body) may take before the search counts as unavailable. */
export const PHOTON_TIMEOUT_MS = 3_000;
const PHOTON_RESULT_LIMIT = 10;
const PHOTON_LANGUAGE = "fr";

// Photon writes null for a field it does not know, or leaves it out: both mean "absent".
const optionalTextSchema = z.string().nullish();

// Only the fields read; Photon sends more. Coordinates are GeoJSON: [longitude, latitude].
const photonFeatureSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    name: optionalTextSchema,
    street: optionalTextSchema,
    city: optionalTextSchema,
    countrycode: optionalTextSchema,
  }),
});

type PhotonFeature = z.infer<typeof photonFeatureSchema>;

// The structure as a whole: when it is wrong, nothing can be read. A wrong feature alone is dropped.
const photonCollectionSchema = z.object({ features: z.array(z.unknown()) });

interface NearPoint {
  readonly lat: number;
  readonly lng: number;
}

function buildSearchUrl(text: string, near: NearPoint): URL {
  const url = new URL(PHOTON_BASE_URL);
  url.searchParams.set("q", text);
  url.searchParams.set("lat", String(near.lat));
  url.searchParams.set("lon", String(near.lng));
  url.searchParams.set("limit", String(PHOTON_RESULT_LIMIT));
  url.searchParams.set("lang", PHOTON_LANGUAGE);
  return url;
}

// Name, street and city, without an empty part or an exact repeat (a city named like the place).
function buildLabel(properties: PhotonFeature["properties"]): string {
  const parts = [properties.name, properties.street, properties.city]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part !== "");
  return [...new Set(parts)].join(", ");
}

// The suggestion schema of the contract drops an empty label and a point out of range.
function toCandidate(feature: unknown): PlaceCandidate[] {
  const parsed = photonFeatureSchema.safeParse(feature);
  if (!parsed.success) {
    return [];
  }
  const { geometry, properties } = parsed.data;
  const [lng, lat] = geometry.coordinates;
  const suggestion = placeSuggestionSchema.safeParse({ label: buildLabel(properties), lat, lng });
  return suggestion.success
    ? [{ ...suggestion.data, countryCode: properties.countrycode ?? undefined }]
    : [];
}

// The timer covers the body too: a server that sends its headers and then stalls is cut as well.
async function fetchJson(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, PHOTON_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new PlaceSearchUnavailableError();
    }
    return await response.json();
  } catch {
    throw new PlaceSearchUnavailableError();
  } finally {
    clearTimeout(timer);
  }
}

/** The adapter of Photon: one search, read into provider-neutral candidates. */
@Injectable()
export class PhotonPlaceSearch {
  async search(text: string, near: NearPoint): Promise<PlaceCandidate[]> {
    const body = await fetchJson(buildSearchUrl(text, near));
    const collection = photonCollectionSchema.safeParse(body);
    if (!collection.success) {
      throw new PlaceSearchUnavailableError();
    }
    return collection.data.features.flatMap(toCandidate);
  }
}
