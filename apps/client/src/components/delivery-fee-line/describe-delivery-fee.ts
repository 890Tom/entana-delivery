import { formatAmount } from "@entana/contracts";
import type { DeliveryQuoteResponse } from "@entana/contracts";

import { texts } from "../../i18n/texts";

/** What the fee line says for a quote: its label, its value, and a note under it or none. */
export interface FeeDescription {
  readonly label: string;
  readonly value: string;
  readonly note: string | null;
}

/**
 * The words of a quote. The place name and the out-of-axis message are the server's, shown as
 * text; when one is missing, the line says "Livraison". The note tells how the fee can be waived.
 */
export function describeDeliveryFee(quote: DeliveryQuoteResponse): FeeDescription {
  const { fee } = texts.delivery;
  switch (quote.reason) {
    case "axis":
      return {
        label: quote.placeName === null ? fee.label : fee.zone(quote.placeName),
        value: fee.free,
        note: null,
      };
    case "quantity":
      return { label: fee.label, value: fee.free, note: fee.freeFrom(quote.freeDeliveryMinPieces) };
    case "out_of_axis":
      return {
        label: quote.outOfAxisMessage ?? fee.label,
        value: formatAmount(quote.feeAr),
        note: fee.freeFrom(quote.freeDeliveryMinPieces),
      };
  }
}

/**
 * The words of the fee frozen on a sent order. The order keeps no place name: the line says
 * "Livraison", with no note, since nothing can change the fee any more.
 */
export function describeFrozenFee(feeAr: number): FeeDescription {
  const { fee } = texts.delivery;
  return { label: fee.label, value: feeAr === 0 ? fee.free : formatAmount(feeAr), note: null };
}
