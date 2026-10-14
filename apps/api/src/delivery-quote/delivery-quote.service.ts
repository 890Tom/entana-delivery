import { Inject, Injectable } from "@nestjs/common";
import type { DeliveryQuoteRequest, DeliveryQuoteResponse, GeoPoint } from "@entana/contracts";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { findDeliverySettings, listActiveAxes } from "./persistence/delivery-quote-queries.js";
import type { DeliveryQuoteReader } from "./persistence/delivery-quote-queries.js";
import { quoteDelivery } from "./rules/quote-delivery.js";
import type { DeliveryQuote } from "./rules/quote-delivery.js";

export type { DeliveryQuote } from "./rules/quote-delivery.js";
export type { DeliveryQuoteReader } from "./persistence/delivery-quote-queries.js";

/** The fee with the settings it was computed from: a quote answers with some of them. */
interface QuoteWithSettings {
  readonly quote: DeliveryQuote;
  readonly outOfAxisMessage: string;
  readonly freeDeliveryMinPieces: number;
}

/**
 * The delivery fee, from the active axes and places and the settings as they are now. The public
 * quote and the order creation use the same computation; an order freezes its result. The point
 * is personal data: it is never logged or stored here. Database errors propagate unchanged.
 */
@Injectable()
export class DeliveryQuoteService {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: DeliveryQuoteReader) {}

  async quote(request: DeliveryQuoteRequest): Promise<DeliveryQuoteResponse> {
    const point = { lat: request.latitude, lng: request.longitude };
    const { quote, outOfAxisMessage, freeDeliveryMinPieces } = await computeWithSettings(
      this.database,
      point,
      request.pieces,
    );
    return {
      feeAr: quote.feeAr,
      reason: quote.reason,
      placeName: quote.placeName,
      outOfAxisMessage: quote.reason === "out_of_axis" ? outOfAxisMessage : null,
      freeDeliveryMinPieces,
    };
  }
}

/**
 * The fee an order is created with, read through the caller's transaction: the public surface the
 * order creation uses. A function, not a method: it needs no state of the service.
 */
export async function computeDeliveryQuote(
  reader: DeliveryQuoteReader,
  point: GeoPoint,
  pieces: number,
): Promise<DeliveryQuote> {
  const { quote } = await computeWithSettings(reader, point, pieces);
  return quote;
}

async function computeWithSettings(
  reader: DeliveryQuoteReader,
  point: GeoPoint,
  pieces: number,
): Promise<QuoteWithSettings> {
  const axes = await listActiveAxes(reader);
  const settings = await findDeliverySettings(reader);
  return {
    quote: quoteDelivery(point, pieces, axes, settings),
    outOfAxisMessage: settings.outOfAxisMessage,
    freeDeliveryMinPieces: settings.freeDeliveryMinPieces,
  };
}
