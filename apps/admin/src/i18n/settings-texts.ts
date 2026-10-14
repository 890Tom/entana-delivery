import { MAX_FREE_DELIVERY_MIN_PIECES, PRODUCT_PRICE_MAX_AR } from "@entana/contracts";

import { formatAmount, groupThousands } from "../order-display/format-order";

import { axisEditorTexts } from "./axis-editor-texts";

// The texts of the settings screen. The texts that the owner's captures do not give are marked
// "to confirm".
export const settingsTexts = {
  title: "Paramètres",
  // To confirm: the name of the list of tabs for assistive technology.
  tabsLabel: "Sections des paramètres",
  tabs: { fees: "Axes et frais", texts: "Textes" },
  // To confirm.
  loadFailed: "Les paramètres n'ont pas pu être chargés. Vérifiez la connexion.",
  save: "Enregistrer",
  notices: {
    // To confirm.
    saved: "Enregistré.",
    invalid: "Une valeur a été refusée. Vérifiez les champs, puis réessayez.",
    rateLimited: "Trop de tentatives. Réessayez dans quelques minutes.",
    failed: "L'enregistrement n'a pas abouti. Vérifiez la connexion, puis réessayez.",
  },
  fees: {
    title: "Hors axe",
    fee: "Frais de livraison hors axe (Ar)",
    feeHint: "Appliqués aux adresses qui ne sont dans aucun axe.",
    // To confirm.
    feeError: `Indiquez un montant entre 0 et ${formatAmount(PRODUCT_PRICE_MAX_AR)}.`,
    // To confirm: the threshold is not on the captures.
    threshold: "Livraison offerte à partir de (pièces)",
    thresholdHint: "Toute commande de ce nombre de pièces ou plus est livrée gratuitement.",
    thresholdError: `Indiquez un nombre de pièces entre 1 et ${groupThousands(String(MAX_FREE_DELIVERY_MIN_PIECES))}.`,
  },
  axes: {
    title: "Axes de livraison",
    help: "Priorité de haut en bas. Glissez un axe pour la changer.",
    listLabel: "Axes, du plus prioritaire au moins prioritaire",
    placeCount: (count: number): string => (count === 1 ? "1 lieu" : `${String(count)} lieux`),
    // To confirm.
    inactive: "Inactif",
    handle: (name: string, position: number, total: number): string =>
      `Déplacer ${name}, priorité ${String(position)} sur ${String(total)}.`,
    freeInside: "Dans un axe, la livraison est gratuite.",
    add: "Ajouter un axe",
    // To confirm: the name of the link of a row for assistive technology.
    edit: (name: string): string => `Modifier ${name}`,
    // To confirm.
    empty: "Aucun axe pour le moment : les frais hors axe s'appliquent partout.",
    // To confirm.
    loadFailed: "Les axes n'ont pas pu être chargés.",
    // To confirm.
    orderChanged: "La liste a changé, elle a été rechargée.",
    // To confirm.
    orderFailed: "La priorité n'a pas été enregistrée. Réessayez.",
    // To confirm: what assistive technology says during a move.
    drag: {
      instructions:
        "Pour déplacer cet axe, appuyez sur Espace, puis sur les flèches haut et bas, et enfin sur Espace pour le déposer. Échap annule.",
      picked: (name: string, position: number, total: number): string =>
        `${name} saisi, priorité ${String(position)} sur ${String(total)}.`,
      moved: (name: string, position: number, total: number): string =>
        `${name} déplacé en priorité ${String(position)} sur ${String(total)}.`,
      dropped: (name: string, position: number, total: number): string =>
        `${name} déposé en priorité ${String(position)} sur ${String(total)}.`,
      cancelled: "Déplacement annulé.",
    },
  },
  map: {
    title: "Carte des axes",
    // To confirm: the names of the map for assistive technology.
    label: "Carte des axes",
    canvasLabel: "Carte des axes. Cliquez pour tester une adresse.",
    markerLabel: "Adresse testée",
    zoomIn: "Zoom avant",
    zoomOut: "Zoom arrière",
    toggleAttribution: "Afficher les crédits de la carte",
    // To confirm.
    failed: "La carte n'a pas pu être chargée. Vérifiez la connexion.",
    prompt: "Cliquez sur la carte pour tester une adresse.",
    // To confirm.
    inside: (axisName: string, placeName: string): string =>
      `Dans ${axisName} (${placeName}) : livraison gratuite`,
    // To confirm.
    outside: (feeAr: number): string => `Hors axe : ${formatAmount(feeAr)}`,
    // To confirm.
    testFailed: "Le test n'a pas abouti. Réessayez.",
  },
  axisEditor: axisEditorTexts,
  texts: {
    title: "Textes",
    message: "Message affiché au client en cas de frais hors axe",
    messageHint: "Une ou deux phrases courtes. Le montant des frais s'affiche à côté.",
    messageEmpty: "Écrivez un message pour le client.",
    // To confirm.
    messageTooLong: "200 caractères au maximum.",
  },
  preview: {
    title: "Aperçu côté client",
    where: "Où livrer ?",
    delivery: "Livraison",
  },
} as const;
