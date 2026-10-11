/**
 * The texts of the tracking screen. None comes from the server: the only server text the screen
 * shows is the shop's reason of a refusal, which is rendered as plain text by the screen.
 */
export interface TrackingTexts {
  /** The title of the document and of the header on a phone. */
  readonly title: string;
  /** The page heading on the web layout. */
  readonly headingWide: string;
  readonly thanks: string;
  readonly stepsLabel: string;
  readonly steps: {
    readonly received: string;
    readonly confirmed: string;
    readonly outForDelivery: string;
    readonly delivered: string;
  };
  /** Read after the name of a step, so that colour and icon are not the only signs. */
  readonly stepStates: {
    readonly done: string;
    readonly current: string;
    readonly upcoming: string;
  };
  readonly awaitingConfirmation: string;
  readonly callToFixDay: string;
  readonly deliveryOn: (day: string) => string;
  readonly courierCalls: string;
  readonly delivered: { readonly title: string; readonly line: string };
  readonly rejected: {
    readonly title: string;
    readonly line: string;
    readonly reason: (reason: string) => string;
  };
  readonly cancelled: { readonly title: string; readonly line: string };
  readonly failed: { readonly title: string; readonly line: string };
  readonly dayCardLabel: string;
  readonly details: {
    readonly items: (count: number) => string;
    readonly payment: string;
  };
  readonly actions: {
    readonly call: string;
    readonly cancel: string;
    readonly reorder: string;
  };
  readonly cancelPanel: {
    readonly title: string;
    readonly text: string;
    readonly confirm: string;
    readonly keep: string;
  };
  readonly cancelErrors: { readonly conflict: string; readonly failed: string };
  readonly code: {
    readonly label: string;
    readonly explanation: string;
    readonly screenshot: string;
    readonly share: string;
    readonly copy: string;
    readonly shareText: (shopName: string, code: string) => string;
  };
  readonly link: {
    readonly copy: string;
    readonly warning: string;
    readonly forget: string;
  };
  readonly feedback: {
    readonly codeCopied: string;
    readonly linkCopied: string;
    readonly copyFailed: string;
    readonly shareFailed: string;
  };
  readonly notFound: { readonly title: string; readonly line: string };
  readonly empty: string;
  readonly viewCatalogue: string;
  readonly loadFailed: string;
  readonly refreshFailed: string;
}

export const trackingTexts: TrackingTexts = {
  title: "Suivi",
  headingWide: "Suivi de votre commande",
  thanks: "Merci ! Votre commande est envoyée.",
  stepsLabel: "Étapes de la livraison",
  steps: {
    received: "Reçue",
    confirmed: "Confirmée",
    outForDelivery: "En livraison",
    delivered: "Livrée",
  },
  stepStates: { done: "(terminé)", current: "(en cours)", upcoming: "(à venir)" },
  awaitingConfirmation: "En attente de confirmation",
  callToFixDay: "Nous vous appelons pour fixer le jour.",
  deliveryOn: (day) => `Livraison le ${day}`,
  courierCalls: "Le livreur vous appelle en arrivant.",
  delivered: { title: "Livrée", line: "Merci ! Bonne dégustation." },
  rejected: {
    title: "Commande refusée",
    line: "La boutique n'a pas pu accepter votre commande.",
    reason: (reason) => `Motif : ${reason}`,
  },
  cancelled: { title: "Commande annulée", line: "Vous pouvez passer une nouvelle commande." },
  failed: {
    title: "Livraison impossible",
    line: "La livraison n'a pas pu avoir lieu. Vous pouvez passer une nouvelle commande.",
  },
  dayCardLabel: "Livraison prévue",
  details: {
    items: (count) => (count > 1 ? `${String(count)} articles` : `${String(count)} article`),
    payment: "Paiement à la livraison, au livreur.",
  },
  actions: {
    call: "Appeler la livraison",
    cancel: "Annuler la commande",
    reorder: "Recommander",
  },
  cancelPanel: {
    title: "Annuler cette commande ?",
    text: "Cette action est définitive. Votre commande ne sera pas livrée.",
    confirm: "Oui, annuler",
    keep: "Non, la garder",
  },
  cancelErrors: {
    conflict: "Cette commande ne peut plus être annulée.",
    failed: "L'annulation n'a pas pu être envoyée.",
  },
  code: {
    label: "Code de commande",
    explanation:
      "Gardez ce code : il vous permet de retrouver votre commande si vous changez de téléphone, perdez votre session ou utilisez un autre appareil.",
    screenshot: "Faites une capture d'écran.",
    share: "Partager le code",
    copy: "Copier le code",
    shareText: (shopName, code) => `Ma commande chez ${shopName} : code ${code}.`,
  },
  link: {
    copy: "Copier le lien",
    warning:
      "Ce lien donne accès à votre commande. Ne le partagez qu'avec des personnes de confiance.",
    forget: "Oublier cette commande",
  },
  feedback: {
    codeCopied: "Code copié.",
    linkCopied: "Lien copié.",
    copyFailed: "La copie n'a pas fonctionné.",
    shareFailed: "Le partage n'a pas fonctionné.",
  },
  notFound: { title: "Commande introuvable.", line: "Le lien ou le code n'est plus valable." },
  empty: "Aucune commande enregistrée sur cet appareil.",
  viewCatalogue: "Voir le catalogue",
  loadFailed: "Le suivi n'a pas pu être chargé. Vérifiez votre connexion.",
  refreshFailed: "Le suivi n'a pas pu être mis à jour.",
};
