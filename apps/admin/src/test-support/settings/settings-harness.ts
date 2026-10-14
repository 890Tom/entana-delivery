import type { AdminDeliveryAxis, DeliverySettings } from "@entana/contracts";

import { texts } from "../../i18n/texts";
import { openAt } from "../catalogue/catalogue-harness";
import { jsonResponse, ROUTES } from "../stubs/stub-api";
import type { ApiStub, Handler } from "../stubs/stub-api";

const SAVED_SETTINGS: DeliverySettings = {
  outOfAxisFeeAr: 4000,
  freeDeliveryMinPieces: 10,
  outOfAxisMessage: "Votre adresse est hors de nos axes de livraison.",
};

/** The answer of the list of axes. */
export const axesList = (...axes: readonly AdminDeliveryAxis[]): Response => jsonResponse({ axes });

/** The tab « Axes et frais », signed in, with the settings saved and the axes the test gives. */
export function openAxesTab(
  axes: Handler,
  handlers: Parameters<typeof openAt>[2] = {},
): Promise<ApiStub> {
  return openAt("/parametres", texts.settings.title, {
    [ROUTES.settings]: () => jsonResponse(SAVED_SETTINGS),
    [ROUTES.axes]: axes,
    ...handlers,
  });
}
