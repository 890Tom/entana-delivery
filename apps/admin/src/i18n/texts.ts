import { PRODUCT_PRICE_MAX_AR } from "@entana/contracts";

import { formatAmount } from "../order-display/format-order";

import { catalogueFormTexts } from "./catalogue-form-texts";
import { ordersTexts } from "./orders-texts";
import { resellersTexts } from "./resellers-texts";
import { settingsTexts } from "./settings-texts";

// Fixed French texts. No text ever comes from the server: every message depends on the kind of
// answer only, so that a response cannot put words in the interface.
export const texts = {
  common: {
    loading: "Chargement…",
    retry: "Réessayer",
  },
  document: {
    title: "Administration",
  },
  login: {
    title: "Connexion",
    subtitle: "Espace réservé à l'équipe",
    logoFallback: "Administration",
    identifier: "Identifiant",
    password: "Mot de passe",
    showPassword: "Afficher",
    hidePassword: "Masquer",
    submit: "Se connecter",
    sending: "Connexion en cours…",
    identifierRequired: "Indiquez votre identifiant.",
    identifierInvalid: "Saisissez une adresse e-mail valide.",
    passwordRequired: "Indiquez votre mot de passe.",
    passwordTooLong: "Le mot de passe est trop long (128 caractères au maximum).",
    wrongCredentials: "Identifiant ou mot de passe incorrect.",
    rateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
    failure: "Connexion impossible. Vérifiez votre connexion.",
    sessionExpired: "Votre session a expiré. Reconnectez-vous.",
  },
  home: {
    logout: "Se déconnecter",
    logoutFailed: "Déconnexion impossible. Réessayez.",
  },
  orders: ordersTexts,
  orderDetail: {
    back: "Commandes",
    title: (code: string): string => `Commande #${code}`,
    // To confirm: the title of the document while the order loads.
    loadingTitle: "Commande",
    notFound: "Commande introuvable.",
    loadFailed: "Impossible de charger la commande.",
    receivedToday: (time: string): string => `Reçue aujourd'hui à ${time}`,
    receivedYesterday: (time: string): string => `Reçue hier à ${time}`,
    receivedOn: (date: string, time: string): string => `Reçue le ${date} à ${time}`,
    conflict: "Cette commande a changé de statut. La page a été mise à jour.",
    lines: {
      title: "Articles",
      unitPrice: (price: string): string => `${price} l'unité`,
      quantity: (count: number): string => `× ${String(count)}`,
      subtotal: (count: number): string => `Articles (${String(count)})`,
      delivery: "Livraison",
      deliveryTo: (place: string): string => `Livraison · ${place}`,
      total: "Total",
    },
    customer: {
      title: "Client",
      call: "Appeler",
      callLabel: (name: string, phone: string): string => `Appeler ${name}, ${phone}`,
    },
    address: {
      title: "Adresse",
      // À confirmer : absent des sources
      outsideAxis: "Hors axe",
      landmark: (text: string): string => `Repère : ${text}`,
      mapLabel: "Carte du point de livraison",
      mapFailed: "La carte n'a pas pu être chargée.",
      markerLabel: "Point de livraison",
      canvasLabel: "Carte",
      zoomIn: "Zoom avant",
      zoomOut: "Zoom arrière",
      toggleAttribution: "Afficher les crédits de la carte",
    },
    decision: {
      title: "Décision",
      dayLegend: "Jour de livraison",
      today: "Aujourd'hui",
      tomorrow: "Demain",
      dayAfter: "Après-demain",
      otherDate: "Autre date",
      calendar: "Calendrier",
      pickDay: "Choisir un jour",
      invalidDay: "Choisissez une date dans les 60 prochains jours.",
      confirmIdle: "Confirmer la commande",
      confirmFor: (day: string): string => `Confirmer pour ${day}`,
      reject: "Refuser…",
      informed: "Le client est informé sur son suivi.",
      // À confirmer : absents des sources
      feeLabel: "Frais de livraison (Ar)",
      feeHint: "Ne modifie que cette commande.",
      feeInvalid: `Indiquez un montant entre 0 et ${formatAmount(PRODUCT_PRICE_MAX_AR)}.`,
      totalTooLarge: "Le total serait trop élevé : la commande n'a pas été modifiée.",
      plannedFor: (day: string): string => `Livraison prévue ${day}`,
      deliveredOn: (day: string): string => `Livrée le ${day}`,
      deliveryDay: (day: string): string => `Jour de livraison : ${day}`,
      status: (label: string): string => `Statut : ${label}`,
      reason: (text: string): string => `Motif : ${text}`,
      startDelivery: "En livraison",
      markDelivered: "Livrée",
      failDelivery: "Livraison échouée…",
    },
    dialog: {
      cancel: "Annuler",
      rejectTitle: (code: string): string => `Refuser la commande #${code}`,
      rejectConfirm: "Refuser la commande",
      reasonLabel: "Motif (facultatif)",
      reasonHelp: "Ce motif sera visible par le client.",
      reasonTooLong: (max: number): string =>
        `Le motif ne doit pas dépasser ${String(max)} caractères.`,
      failTitle: (code: string): string => `Livraison échouée pour la commande #${code} ?`,
      failBody: "La commande sera marquée en échec de livraison.",
      failConfirm: "Confirmer l'échec",
    },
    history: {
      title: "Historique",
      received: "Reçue",
      confirmed: "Confirmée",
      outForDelivery: "En livraison",
      delivered: "Livrée",
      rejected: "Refusée",
      cancelled: "Annulée",
      failed: "Échec",
      byCustomer: "par le client",
      byStaff: "par l'équipe",
      bySystem: "par le système",
    },
  },
  catalogue: {
    title: "Catalogue",
    // 0 and 1 are singular, as in French.
    productCount: (count: number): string => `${String(count)} produit${count >= 2 ? "s" : ""}`,
    unavailableCount: (count: number): string =>
      `${String(count)} indisponible${count >= 2 ? "s" : ""}`,
    retiredCount: (count: number): string => `${String(count)} retiré${count >= 2 ? "s" : ""}`,
    loading: "Chargement du catalogue…",
    loadFailed: "Le catalogue n'a pas pu être chargé. Vérifiez la connexion.",
    tabsLabel: "Filtrer les produits",
    tabs: {
      all: "Tous",
      available: "Disponibles",
      unavailable: "Indisponibles",
      retired: "Retirés",
    },
    searchLabel: "Rechercher un produit",
    searchPlaceholder: "Rechercher un produit",
    tableLabel: "Produits du catalogue",
    columns: {
      handle: "Déplacer",
      photo: "Photo",
      product: "Produit",
      price: "Prix",
      availability: "Disponible aujourd'hui",
      actions: "Actions",
    },
    addProduct: "Ajouter un produit",
    help: "Glissez les lignes pour changer l'ordre d'affichage (au clavier : poignée puis flèches haut et bas). Un produit reste indisponible jusqu'à ce que vous le réactiviez.",
    row: {
      handle: (name: string, position: number, total: number): string =>
        `Déplacer ${name}, position ${String(position)} sur ${String(total)}`,
      photoAlt: "Photo à venir",
      switchLabel: (name: string): string => `Disponible aujourd'hui : ${name}`,
      available: "Disponible",
      unavailable: "Indisponible",
      unavailableSince: (days: number): string => {
        if (days === 0) {
          return "Indisponible depuis aujourd'hui";
        }
        return days === 1
          ? "Indisponible depuis hier"
          : `Indisponible depuis ${String(days)} jours`;
      },
      retired: "Retiré",
      menu: (name: string): string => `Actions pour ${name}`,
      edit: "Modifier",
      retire: "Retirer",
      restore: "Restaurer",
    },
    dialog: {
      title: (name: string): string => `Retirer ${name} du catalogue ?`,
      body: "Il ne sera plus visible par les clients. Les commandes passées ne changent pas.",
      cancel: "Annuler",
      confirm: "Retirer",
    },
    notices: {
      changeFailed: "Le changement n'a pas pu être enregistré. Réessayez.",
      retiredMeanwhile: "Ce produit a été retiré. La liste a été mise à jour.",
      orderFailed: "L'ordre n'a pas pu être enregistré. La liste a été mise à jour.",
      retired: (name: string): string => `${name} est retiré du catalogue.`,
      restored: (name: string): string => `${name} est restauré (indisponible).`,
    },
    empty: {
      noProduct: "Aucun produit pour le moment.",
      emptyList: "Aucun produit dans cette liste.",
      noMatch: (term: string): string => `Aucun produit ne correspond à « ${term} ».`,
      clearSearch: "Effacer la recherche",
    },
    drag: {
      instructions:
        "Pour déplacer ce produit, appuyez sur Espace, puis sur les flèches haut et bas, et enfin sur Espace pour le déposer. Échap annule.",
      picked: (name: string, position: number, total: number): string =>
        `${name} saisi, position ${String(position)} sur ${String(total)}.`,
      moved: (name: string, position: number, total: number): string =>
        `${name} déplacé en position ${String(position)} sur ${String(total)}.`,
      dropped: (name: string, position: number, total: number): string =>
        `${name} déposé en position ${String(position)} sur ${String(total)}.`,
      cancelled: "Déplacement annulé.",
    },
  },
  catalogueForm: catalogueFormTexts,
  resellers: resellersTexts,
  settings: settingsTexts,
  notFound: {
    title: "Page introuvable",
    message: "Cette page n'existe pas.",
    back: "Retour à l'accueil",
  },
} as const;
