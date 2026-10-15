import type { CatalogueErrorKind } from "../features/catalogue/api/fetch-products";

import { appUpdateTexts } from "./app-update-texts";
import type { AppUpdateTexts } from "./app-update-texts";
import { findOrderTexts } from "./find-order-texts";
import type { FindOrderTexts } from "./find-order-texts";
import { resellersTexts } from "./resellers-texts";
import type { ResellersTexts } from "./resellers-texts";
import { reviewTexts } from "./review-texts";
import type { ReviewTexts } from "./review-texts";
import { trackingTexts } from "./tracking-texts";
import type { TrackingTexts } from "./tracking-texts";

/** "32, 33 ou 34": commas, and "ou" before the last item. */
function listWithOr(items: readonly string[]): string {
  const last = items.at(-1);
  return items.length < 2 || last === undefined
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} ou ${last}`;
}

// Fixed French texts, keyed as in the screen specification. Error messages depend only on the
// kind of error, never on a server text. The title is a generic default: a deployment's own
// wording will come from the instance configuration.
export const texts: {
  readonly common: {
    readonly loading: string;
    readonly retry: string;
    /** Between the label of a link and the amount it shows. */
    readonly amountSeparator: string;
    /** Read after the label of a field that may stay empty. */
    readonly optional: string;
  };
  readonly shell: {
    readonly genericName: string;
    readonly homeLabel: (name: string) => string;
    /** The way back from the cart screen to the catalogue. */
    readonly back: string;
    /** The way back from the delivery screen to the cart. */
    readonly backToCart: string;
    /** The way back from the contact screen to the delivery screen. */
    readonly backToAddress: string;
    /** The way back from the review screen to the contact screen. */
    readonly backToContact: string;
    readonly steps: {
      readonly label: string;
      /** Read after the name of a step that is already behind the customer. */
      readonly done: string;
      readonly position: (current: number, total: number) => string;
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
  /** Here "point" is the marker on the map; "Repère" is the written field. */
  readonly delivery: {
    /** The title of the document; the page heading is `heading`. */
    readonly title: string;
    readonly heading: string;
    readonly subtitle: string;
    readonly place: string;
    readonly placed: string;
    readonly locate: string;
    /** The written landmark field, mandatory. */
    readonly landmark: {
      readonly label: string;
      readonly hint: string;
      readonly error: string;
    };
    /** Shown when the customer continues without having placed the point on the map. */
    readonly pointMissing: string;
    readonly continue: string;
    /**
     * The delivery fee line, shared with the next screens of the order. The texts other than
     * `label` and `free` are to confirm (6g-8b).
     */
    readonly fee: {
      readonly label: string;
      readonly free: string;
      /** Inside an axis: the place the server found for the point. */
      readonly zone: (placeName: string) => string;
      /** Under a fee that the quantity can waive. */
      readonly freeFrom: (pieces: number) => string;
      readonly failed: string;
    };
    readonly geo: {
      readonly denied: string;
      readonly unavailable: string;
      readonly timeout: string;
    };
    readonly map: {
      readonly label: string;
      /** Read by a screen reader on the map itself: how to move it without a pointer. */
      readonly canvasLabel: string;
      readonly markerLabel: string;
      readonly zoomIn: string;
      readonly zoomOut: string;
      readonly toggleAttribution: string;
      readonly failed: string;
    };
  };
  readonly contact: {
    /** The title of the document; the page heading is `heading`. */
    readonly title: string;
    readonly heading: string;
    readonly name: { readonly label: string; readonly error: string };
    readonly phone: {
      readonly label: string;
      readonly hint: string;
      readonly placeholder: string;
      /** The country code shown before what the customer types. */
      readonly prefix: (countryCode: string) => string;
      readonly errors: {
        readonly missingDigits: string;
        /** Names what a number must start with: the prefixes come from the contract. */
        readonly invalidPrefix: (prefixes: readonly string[]) => string;
        readonly invalid: string;
      };
      /** In place of the field when the configuration, which holds the country code, fails. */
      readonly configurationError: string;
    };
    readonly note: {
      readonly label: string;
      readonly placeholder: string;
      readonly error: string;
    };
    readonly dateNotice: string;
    readonly continue: string;
  };
  /** The review of the order and its sending. */
  readonly review: ReviewTexts;
  /** The tracking of an order. */
  readonly tracking: TrackingTexts;
  readonly findOrder: FindOrderTexts;
  readonly appUpdate: AppUpdateTexts;
  /** The screen "Où nous trouver": the resellers on a map and in a list. */
  readonly resellers: ResellersTexts;
  /** The summary of the order, shared by the screens that come after the cart. */
  readonly orderSummary: {
    readonly title: string;
    readonly quantity: (quantity: number) => string;
    readonly total: string;
  };
  readonly cart: {
    readonly badgeLabel: (count: number) => string;
    readonly removedUnavailable: string;
    readonly screen: {
      readonly title: string;
      readonly heading: string;
      readonly subtotal: string;
      readonly empty: { readonly text: string; readonly action: string };
      readonly continue: string;
    };
    /** The side cart of the web layout. */
    readonly panel: {
      readonly title: string;
      readonly empty: string;
      readonly noAccount: string;
    };
  };
  readonly catalogue: {
    readonly title: string;
    readonly empty: string;
    readonly viewCart: string;
    /** The banner above the products while the latest order of the device is still going on. */
    readonly activeOrder: { readonly text: string; readonly action: string };
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
    amountSeparator: " · ",
    optional: "(facultatif)",
  },
  shell: {
    // Shown instead of the shop name when the instance configuration cannot be loaded.
    genericName: "Boutique",
    homeLabel: (name) => `${name} - accueil`,
    back: "Retour aux produits",
    backToCart: "Retour au panier",
    backToAddress: "Retour à l'adresse",
    backToContact: "Retour aux coordonnées",
    steps: {
      label: "Étapes de la commande",
      done: "(terminé)",
      position: (current, total) => `Étape ${String(current)} sur ${String(total)}`,
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
  delivery: {
    title: "Livraison",
    heading: "Où livrer\u00a0?",
    subtitle: "Touchez la carte pour placer le point de livraison.",
    place: "Placer ici",
    placed: "Point placé.",
    locate: "Utiliser ma position",
    landmark: {
      label: "Repère",
      hint: "Ex. portail bleu, près de l'école",
      error: "Indiquez un repère pour le livreur.",
    },
    pointMissing: "Placez le point de livraison sur la carte.",
    continue: "Continuer",
    fee: {
      label: "Livraison",
      free: "Gratuite",
      zone: (placeName) => `Zone\u00a0: ${placeName}`,
      freeFrom: (pieces) => `Livraison offerte dès ${String(pieces)}\u00a0pièces.`,
      failed: "Impossible de calculer les frais de livraison.",
    },
    geo: {
      denied: "Position refusée. Autorisez-la dans votre navigateur ou touchez la carte.",
      unavailable: "Position indisponible. Touchez la carte pour placer le point.",
      timeout: "La position met trop de temps. Réessayez ou touchez la carte.",
    },
    map: {
      label: "Carte du point de livraison",
      canvasLabel: "Carte. Flèches pour la déplacer, plus et moins pour zoomer.",
      markerLabel: "Point de livraison",
      zoomIn: "Zoom avant",
      zoomOut: "Zoom arrière",
      toggleAttribution: "Afficher les crédits de la carte",
      failed: "La carte n'a pas pu se charger. Réessayez ou utilisez votre position.",
    },
  },
  contact: {
    title: "Coordonnées",
    heading: "Vos coordonnées",
    name: { label: "Nom", error: "Indiquez votre nom." },
    phone: {
      label: "Téléphone",
      hint: "Nous vous appelons pour confirmer.",
      placeholder: "Ex. 34 12 345 67",
      prefix: (countryCode) => `+${countryCode}`,
      errors: {
        missingDigits: "Il manque des chiffres.",
        invalidPrefix: (prefixes) => `Ce numéro ne commence pas par ${listWithOr(prefixes)}.`,
        invalid: "Indiquez un numéro de téléphone valide.",
      },
      configurationError: "Nous n'avons pas pu charger la configuration.",
    },
    note: {
      label: "Note pour le livreur",
      placeholder: "Ex. appelez en arrivant",
      error: "Retirez les caractères spéciaux de la note.",
    },
    dateNotice: "Notre équipe confirme la date de livraison.",
    continue: "Vérifier la commande",
  },
  review: reviewTexts,
  tracking: trackingTexts,
  findOrder: findOrderTexts,
  appUpdate: appUpdateTexts,
  resellers: resellersTexts,
  orderSummary: {
    title: "Votre commande",
    quantity: (quantity) => `× ${String(quantity)}`,
    total: "Total",
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
      subtotal: "Sous-total",
      empty: { text: "Votre panier est vide.", action: "Voir les produits" },
      continue: "Choisir où livrer",
    },
    panel: {
      title: "Votre panier",
      empty: "Votre panier est vide. Ajoutez des produits.",
      noAccount: "Pas de compte à créer.",
    },
  },
  catalogue: {
    title: "Nos produits",
    empty: "Aucun produit disponible pour le moment.",
    viewCart: "Voir le panier",
    activeOrder: { text: "Votre commande est en cours.", action: "Suivre ma commande" },
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
