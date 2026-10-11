import { reviewTexts } from "./review-texts";
import { trackingTexts } from "./tracking-texts";

/**
 * The texts of the screen that finds an order again with the phone number and the order code.
 * None comes from the server, and one text covers every reason why no order is found: the screen
 * never says whether the code or the number was the wrong one.
 */
export interface FindOrderTexts {
  /** The title of the document and the page heading. */
  readonly title: string;
  readonly intro: string;
  readonly code: {
    readonly label: string;
    readonly hint: string;
    readonly error: string;
  };
  readonly submit: string;
  readonly notFound: string;
  readonly rateLimited: string;
  /** The network or the server failed: the same notice as the tracking screen's. */
  readonly failed: string;
  readonly refresh: string;
  readonly another: string;
  /** The link to this screen, from the tracking screen. */
  readonly entry: string;
}

export const findOrderTexts: FindOrderTexts = {
  title: "Retrouver ma commande",
  intro: "Saisissez le téléphone utilisé pour commander et le code de votre commande.",
  code: {
    label: "Code de commande",
    hint: "Le code figure sur l'écran de suivi, ou demandez-le à notre équipe.",
    error: "Vérifiez le code de commande.",
  },
  submit: "Retrouver ma commande",
  notFound: "Aucune commande ne correspond à ces informations.",
  rateLimited: reviewTexts.errors.rateLimited,
  failed: trackingTexts.loadFailed,
  refresh: "Actualiser",
  another: "Chercher une autre commande",
  entry: "Retrouver ma commande",
};
