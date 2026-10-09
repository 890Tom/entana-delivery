import type { CatalogueErrorKind } from "../features/catalogue/api/fetch-products";

// Fixed French texts, keyed as in the screen specification. Error messages depend only on the
// kind of error, never on a server text. The title is a generic default: a deployment's own
// wording will come from the instance configuration.
export const texts: {
  readonly common: {
    readonly loading: string;
    readonly retry: string;
  };
  readonly shell: {
    readonly genericName: string;
    readonly homeLabel: (name: string) => string;
    readonly steps: {
      readonly label: string;
      readonly cart: string;
      readonly address: string;
      readonly contact: string;
      readonly send: string;
      readonly tracking: string;
    };
  };
  readonly notFound: {
    readonly title: string;
    readonly message: string;
    readonly back: string;
  };
  readonly cart: {
    readonly badgeLabel: (count: number) => string;
    readonly removedUnavailable: string;
    readonly screen: {
      readonly title: string;
      readonly heading: string;
      readonly unitPrice: (formattedPrice: string) => string;
      readonly subtotal: string;
      readonly deliveryHint: string;
      readonly empty: { readonly text: string; readonly action: string };
    };
  };
  readonly catalogue: {
    readonly title: string;
    readonly empty: string;
    readonly product: {
      readonly unavailable: string;
      readonly add: string;
      readonly addAria: (name: string) => string;
      readonly quantityGroup: (name: string) => string;
      readonly decreaseAria: (name: string) => string;
      readonly removeAria: (name: string) => string;
      readonly increaseAria: (name: string) => string;
    };
    readonly errors: Readonly<Record<CatalogueErrorKind, string>>;
  };
} = {
  common: {
    loading: "Chargement…",
    retry: "Réessayer",
  },
  shell: {
    // Shown instead of the shop name when the instance configuration cannot be loaded.
    genericName: "Boutique",
    homeLabel: (name) => `${name} - accueil`,
    steps: {
      label: "Étapes de la commande",
      cart: "Panier",
      address: "Adresse",
      contact: "Coordonnées",
      send: "Envoi",
      tracking: "Suivi",
    },
  },
  notFound: {
    title: "Page introuvable",
    message: "Cette page n'existe pas ou a été déplacée.",
    back: "Retour aux produits",
  },
  cart: {
    badgeLabel: (count) =>
      count === 0
        ? "Voir le panier"
        : `Voir le panier, ${String(count)} ${count > 1 ? "articles" : "article"}`,
    removedUnavailable:
      "Certains produits ne sont plus disponibles et ont été retirés de votre panier.",
    screen: {
      title: "Panier",
      heading: "Votre panier",
      unitPrice: (formattedPrice) => `${formattedPrice} l'unité`,
      subtotal: "Sous-total",
      deliveryHint: "Frais de livraison selon votre zone.",
      empty: { text: "Votre panier est vide.", action: "Voir les produits" },
    },
  },
  catalogue: {
    title: "Nos produits",
    empty: "Aucun produit disponible pour le moment.",
    product: {
      unavailable: "Indisponible aujourd'hui",
      add: "Ajouter",
      addAria: (name) => `Ajouter ${name} au panier`,
      quantityGroup: (name) => `Quantité — ${name}`,
      decreaseAria: (name) => `Retirer une unité de ${name}`,
      removeAria: (name) => `Retirer ${name} du panier`,
      increaseAria: (name) => `Ajouter une unité de ${name}`,
    },
    errors: {
      network: "Impossible de joindre le serveur. Vérifiez votre connexion.",
      timeout: "Le serveur met trop de temps à répondre.",
      server: "Le service est momentanément indisponible.",
      unexpected: "Une réponse inattendue a été reçue.",
    },
  },
};
