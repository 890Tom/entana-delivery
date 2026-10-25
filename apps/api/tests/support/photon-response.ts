/** A feature of a Photon answer, reduced to the fields the API reads. */
export interface PhotonFeature {
  readonly type: "Feature";
  readonly geometry: { readonly type: "Point"; readonly coordinates: readonly [number, number] };
  readonly properties: {
    readonly name?: string | null;
    readonly street?: string | null;
    readonly city?: string | null;
    readonly countrycode?: string;
  };
}

export function buildPhotonFeature(
  coordinates: readonly [number, number],
  properties: PhotonFeature["properties"],
): PhotonFeature {
  return { type: "Feature", geometry: { type: "Point", coordinates }, properties };
}

export function buildPhotonCollection(features: readonly unknown[]): Record<string, unknown> {
  return { type: "FeatureCollection", features };
}

/**
 * The real answer of Photon for q=gare routiere near the centre of Antananarivo (limit=10,
 * lang=fr), reduced to the fields the API reads. Coordinates are [longitude, latitude].
 */
export const GARE_ROUTIERE_FEATURES: readonly PhotonFeature[] = [
  buildPhotonFeature([47.5138169, -18.92443], {
    name: "Gare Routière du Sud",
    street: "Rue du Pasteur Rahajason",
    city: "Antananarivo",
    countrycode: "MG",
  }),
  buildPhotonFeature([47.4959614, -18.8980441], {
    name: "Gare routière MAKI",
    street: "Route de la Digue",
    city: "Antananarivo",
    countrycode: "MG",
  }),
  buildPhotonFeature([47.4958183, -18.8975663], {
    name: "Gare Routière Maki",
    street: "RN4, Rocade Andohatapenaka",
    city: "Antananarivo",
    countrycode: "MG",
  }),
  buildPhotonFeature([47.5487896, -18.8938177], {
    name: "Gare routière Ampasampito",
    street: null,
    city: "Antananarivo",
    countrycode: "MG",
  }),
  buildPhotonFeature([47.524607, -18.9454006], {
    name: "Gare routière FICOTRANS Ankadimbahoaka",
    street: null,
    city: "Antananarivo",
    countrycode: "MG",
  }),
  buildPhotonFeature([47.5412556, -18.8828925], {
    name: "Gare Routière Trans NIAINA",
    street: "RN3",
    city: "Antananarivo",
    countrycode: "MG",
  }),
  buildPhotonFeature([47.4398136, -19.3806567], {
    name: "Gare routière SOATRANS AMBATOLAMPY",
    street: null,
    city: "Ambatolampy",
    countrycode: "MG",
  }),
  buildPhotonFeature([47.4320541, -19.5227047], {
    name: "Gare Routière (Tana-Ambohimandroso, Ambohimandroso-Antsirabe)",
    street: null,
    city: "Ambohimandroso",
    countrycode: "MG",
  }),
  buildPhotonFeature([47.431629, -19.525684], {
    name: "Gare Routière (Tana-Ambohimandroso, Ambohimandroso-Antanifotsy)",
    street: null,
    city: "Ambohimandroso",
    countrycode: "MG",
  }),
  buildPhotonFeature([46.4693285, -18.9970885], {
    name: "Gare routière",
    street: "route secondaire",
    city: "Ankadinondry Sakay",
    countrycode: "MG",
  }),
];

/** A place outside Madagascar, with fake values. */
export const FOREIGN_FEATURE: PhotonFeature = buildPhotonFeature([2.35, 48.85], {
  name: "Fake Foreign Station",
  street: "Fake Street",
  city: "Fake City",
  countrycode: "FR",
});

/** A `fetch` that answers `body` as JSON with `status`. */
export function respondWith(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
