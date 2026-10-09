import type { CatalogueErrorKind } from "../features/catalogue/api/fetch-products";

// Fixed French texts, keyed as in the screen specification. Error messages depend only on the
// kind of error, never on a server text. The title is a generic default: a deployment's own
// wording will come from the instance configuration.
export const texts: {
  readonly common: {
    readonly loading: string;
    readonly retry: string;
  };
  readonly catalogue: {
    readonly title: string;
    readonly empty: string;
    readonly product: {
      readonly unavailable: string;
    };
    readonly errors: Readonly<Record<CatalogueErrorKind, string>>;
  };
} = {
  common: {
    loading: "Chargement…",
    retry: "Réessayer",
  },
  catalogue: {
    title: "Nos produits",
    empty: "Aucun produit disponible pour le moment.",
    product: {
      unavailable: "Indisponible aujourd'hui",
    },
    errors: {
      network: "Impossible de joindre le serveur. Vérifiez votre connexion.",
      timeout: "Le serveur met trop de temps à répondre.",
      server: "Le service est momentanément indisponible.",
      unexpected: "Une réponse inattendue a été reçue.",
    },
  },
};
