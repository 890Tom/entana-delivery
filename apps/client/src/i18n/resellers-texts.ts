import type { ResellersErrorKind } from "../features/resellers/api/fetch-resellers";

/**
 * The texts of the screen "Où nous trouver". Every text that is not on the owner's screenshots is
 * to be confirmed (marked below). None comes from the server.
 */
export interface ResellersTexts {
  /** The title of the document, the page heading and the name of the link to the screen. */
  readonly title: string;
  readonly neighborhood: { readonly label: string; readonly placeholder: string };
  readonly nearby: string;
  /** The counter; with a position the list is sorted and says so. Singular for one. */
  readonly count: (count: number, isSortedByDistance: boolean) => string;
  /** "{neighborhood} · {distance}". */
  readonly shopMeta: (neighborhood: string, distance: string | null) => string;
  readonly route: string;
  readonly routeLabel: (name: string) => string;
  readonly empty: { readonly title: string; readonly text: string };
  readonly noMatch: {
    readonly title: string;
    readonly text: string;
    readonly action: string;
  };
  readonly errors: Readonly<Record<ResellersErrorKind, string>>;
  /** Why the position could not be known. The order of the list does not change. */
  readonly geo: {
    readonly denied: string;
    readonly unavailable: string;
    readonly timeout: string;
  };
  readonly map: {
    readonly label: string;
    readonly canvasLabel: string;
    readonly zoomIn: string;
    readonly zoomOut: string;
    readonly toggleAttribution: string;
    readonly userPosition: string;
    readonly failed: string;
  };
}

export const resellersTexts: ResellersTexts = {
  title: "Où nous trouver",
  neighborhood: { label: "Quartier", placeholder: "Ex. Isotry" },
  nearby: "Autour de moi",
  count: (count, isSortedByDistance) => {
    const noun = count === 1 ? "point de vente" : "points de vente";
    // To confirm: the singular, and the sorted variant for one point.
    return isSortedByDistance
      ? `${String(count)} ${noun}, du plus proche au plus loin`
      : `${String(count)} ${noun}`;
  },
  shopMeta: (neighborhood, distance) =>
    distance === null ? neighborhood : `${neighborhood} · ${distance}`,
  route: "Itinéraire",
  // To confirm: wording of the full name read by a screen reader.
  routeLabel: (name) => `Itinéraire vers ${name}`,
  // To confirm: the whole block (empty list and filter without result).
  empty: {
    title: "Aucun point de vente pour le moment.",
    text: "Revenez bientôt ou contactez-nous.",
  },
  noMatch: {
    title: "Aucun point de vente trouvé.",
    text: "Essayez un autre quartier ou retirez le filtre.",
    action: "Tout afficher",
  },
  // To confirm: same wording as the catalogue's.
  errors: {
    network: "Impossible de joindre le serveur. Vérifiez votre connexion.",
    timeout: "Le serveur met trop de temps à répondre.",
    server: "Le service est momentanément indisponible.",
    unexpected: "Une réponse inattendue a été reçue.",
  },
  // To confirm: no text for this screen in the sources.
  geo: {
    denied: "Position refusée. Autorisez-la dans votre navigateur pour trier par distance.",
    unavailable: "Position indisponible pour le moment. La liste garde son ordre.",
    timeout: "La position met trop de temps. Réessayez.",
  },
  // To confirm: the whole block.
  map: {
    label: "Carte des points de vente",
    canvasLabel: "Carte. Flèches pour la déplacer, plus et moins pour zoomer.",
    zoomIn: "Zoom avant",
    zoomOut: "Zoom arrière",
    toggleAttribution: "Afficher les crédits de la carte",
    userPosition: "Votre position",
    failed: "La carte n'a pas pu se charger. La liste reste disponible.",
  },
};
