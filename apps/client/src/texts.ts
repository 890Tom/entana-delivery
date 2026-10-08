import type { CatalogueErrorKind } from "./catalogue/fetch-products";

// Fixed French texts. Error messages depend only on the kind of error, never on a server text.
export const texts: {
  readonly appTitle: string;
  readonly catalogue: {
    readonly loading: string;
    readonly empty: string;
    readonly retry: string;
    readonly soldOut: string;
    readonly errors: Readonly<Record<CatalogueErrorKind, string>>;
  };
} = {
  appTitle: "Entana Delivery",
  catalogue: {
    loading: "Chargement du catalogue…",
    empty: "Aucun produit disponible pour le moment.",
    retry: "Réessayer",
    soldOut: "Épuisé",
    errors: {
      network: "Impossible de joindre le serveur. Vérifiez votre connexion.",
      timeout: "Le serveur met trop de temps à répondre.",
      server: "Le service est momentanément indisponible.",
      unexpected: "Une réponse inattendue a été reçue.",
    },
  },
};
