import { MAX_FREE_DELIVERY_MIN_PIECES, PRODUCT_PRICE_MAX_AR } from "@entana/contracts";

import { formatAmount, groupThousands } from "../order-display/format-order";

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
