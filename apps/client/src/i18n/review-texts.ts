/**
 * The texts of the order review and its sending. Errors depend on a type, never on a server
 * text. Kept apart from the other screens' texts: this block is the longest.
 */
export interface ReviewTexts {
  /** The title of the document and of the header on a phone. */
  readonly title: string;
  /** The page heading: on a phone, then on the web layout. */
  readonly headingNarrow: string;
  readonly headingWide: string;
  /** The title of the amounts card: on a phone, then on the web layout. */
  readonly itemsTitle: string;
  readonly summaryTitle: string;
  readonly delivery: {
    readonly title: string;
    readonly address: string;
    readonly contact: string;
    readonly edit: string;
    readonly editAddress: string;
    readonly editContact: string;
    readonly contactLine: (name: string, phone: string) => string;
    readonly note: (note: string) => string;
    readonly date: string;
  };
  readonly payment: string;
  readonly send: string;
  /** Announced while the order is being sent; the button keeps its label. */
  readonly sending: string;
  readonly configurationError: string;
  readonly errors: {
    readonly offline: string;
    /** Network and timeout. */
    readonly connection: string;
    readonly rateLimited: string;
    /** Service unavailable and server error. */
    readonly serviceUnavailable: string;
    readonly unconfirmed: string;
    readonly toFix: string;
    readonly unavailableProducts: (names: readonly string[]) => string;
    readonly orderTooLarge: string;
    readonly blocked: string;
    readonly conflict: string;
    readonly unexpected: string;
    readonly viewCart: string;
  };
}

export const reviewTexts: ReviewTexts = {
  title: "Récapitulatif",
  headingNarrow: "Votre commande",
  headingWide: "Récapitulatif",
  itemsTitle: "Articles",
  summaryTitle: "Votre commande",
  delivery: {
    title: "Livraison",
    address: "Adresse",
    contact: "Coordonnées",
    edit: "Modifier",
    editAddress: "Modifier l'adresse",
    editContact: "Modifier les coordonnées",
    contactLine: (name, phone) => `${name} · ${phone}`,
    note: (note) => `Note : ${note}`,
    date: "Date de livraison confirmée par notre équipe.",
  },
  payment: "Paiement à la livraison, au livreur.",
  send: "Envoyer la commande",
  sending: "Envoi de la commande en cours.",
  configurationError: "Nous n'avons pas pu charger la configuration.",
  errors: {
    offline: "Pas de connexion. Votre commande n'est pas envoyée.",
    connection: "L'envoi a échoué. Vérifiez votre connexion et réessayez.",
    rateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
    serviceUnavailable: "Le service est momentanément indisponible. Réessayez.",
    unconfirmed:
      "Nous n'avons pas pu confirmer votre commande. Elle a peut-être été enregistrée : réessayez, aucun doublon ne sera créé.",
    toFix: "Certaines informations sont à corriger.",
    unavailableProducts: (names) =>
      names.length === 0
        ? "Certains produits ne sont plus disponibles."
        : `Certains produits ne sont plus disponibles : ${names.join(", ")}.`,
    orderTooLarge:
      "Votre commande est trop importante pour être envoyée en ligne. Contactez la boutique.",
    blocked: "Nous ne pouvons pas enregistrer cette commande. Contactez la boutique.",
    conflict:
      "Une commande avec ces informations existe peut-être déjà. Contactez la boutique avant de recommencer.",
    unexpected: "Une erreur est survenue. Réessayez.",
    viewCart: "Voir le panier",
  },
};
