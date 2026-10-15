import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  computeOrderTotal,
  doesAmountFitColumn,
  generateOrderCode,
  parsePhoneNumber,
} from "@entana/contracts";
import type { CreateOrderRequest, CreateOrderResponse } from "@entana/contracts";
import { classifyDatabaseError } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { computeDeliveryQuote } from "../delivery-quote/delivery-quote.service.js";
import type {
  DeliveryQuote,
  DeliveryQuoteReader,
} from "../delivery-quote/delivery-quote.service.js";
import { insertOrder } from "./persistence/insert-order.js";
import { matchesStoredOrder, toCreateOrderResponse } from "./rules/matches-stored-order.js";
import type { StoredOrder } from "./rules/matches-stored-order.js";
import {
  CustomerBlockedError,
  IdempotencyConflictError,
  InvalidPhoneError,
  OrderCreationFailedError,
  OrderRateLimitedError,
  OrderTooLargeError,
  UnavailableProductsError,
} from "./errors/order-errors.js";
import {
  getRateLimitWindowStart,
  isRateLimited,
  MAX_CREATION_ATTEMPTS,
} from "./rules/order-limits.js";
import {
  countOrdersSince,
  ensureCustomer,
  findOrderByIdempotencyKey,
  lockCustomerRow,
  readProducts,
} from "./persistence/order-queries.js";
import type { OrderReader } from "./persistence/order-queries.js";
import { resolveOrderLines } from "./rules/resolve-order-lines.js";
import type { OrderLine } from "./rules/resolve-order-lines.js";

/** n unpredictable bytes: the API passes node:crypto's `randomBytes`. */
export type RandomBytes = (count: number) => Uint8Array;

export const ORDER_RANDOM_BYTES = Symbol("ORDER_RANDOM_BYTES");
export const PHONE_COUNTRY_CODE = Symbol("PHONE_COUNTRY_CODE");

/** What the service needs from the database client: the PrismaClient fits. */
export type OrdersDatabase = Pick<PrismaClient, "$transaction" | "customerOrder">;

export interface CreateOrderResult {
  readonly response: CreateOrderResponse;
  readonly replayed: boolean;
}

type TransactionOutcome =
  | { readonly kind: "created"; readonly order: StoredOrder }
  | { readonly kind: "existing"; readonly order: StoredOrder };

/** What a creation writes and reads in its transaction. */
type CreationTransaction = OrderReader & DeliveryQuoteReader & Pick<PrismaClient, "customerOrder">;

interface PricedOrder {
  readonly lines: readonly OrderLine[];
  readonly fee: DeliveryQuote;
  readonly totalAr: number;
}

interface Attempt {
  readonly request: CreateOrderRequest;
  readonly idempotencyKey: string;
  readonly phoneE164: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: OrdersDatabase,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ORDER_RANDOM_BYTES) private readonly randomBytes: RandomBytes,
    @Inject(PHONE_COUNTRY_CODE) private readonly phoneCountryCode: string,
  ) {}

  /**
   * Creates an order from a validated request, idempotently, in one transaction. A replay (same
   * key, same request) writes and locks nothing. Prices and names are read from the database.
   * Domain errors are typed with fixed messages; database errors propagate unchanged.
   */
  async createOrder(
    request: CreateOrderRequest,
    idempotencyKey: string,
  ): Promise<CreateOrderResult> {
    // The numbering plan of the shop's country: what is stored, and what keys the customer, the
    // row lock and the per-phone limit, is always the canonical form.
    const phone = parsePhoneNumber(request.phone, this.phoneCountryCode);
    if (!phone.ok) {
      throw new InvalidPhoneError();
    }
    const phoneE164 = phone.e164;
    // The one place where the key is normalised: a uuid is valid in both cases, and the database
    // compares text, so "ABC…" and "abc…" would be two keys. Every lookup and the stored value
    // below use this form.
    const normalizedKey = idempotencyKey.toLowerCase();
    const attempt: Attempt = { request, idempotencyKey: normalizedKey, phoneE164 };
    // Before any transaction: a replay takes no lock and writes nothing.
    const existing = await findOrderByIdempotencyKey(this.database, normalizedKey);
    return existing === null ? this.createWithRetries(attempt) : toReplay(existing, attempt);
  }

  private async createWithRetries(attempt: Attempt): Promise<CreateOrderResult> {
    for (let number = 1; number <= MAX_CREATION_ATTEMPTS; number += 1) {
      try {
        const outcome = await this.database.$transaction((transaction) =>
          this.createInTransaction(transaction, attempt),
        );
        return outcome.kind === "created"
          ? { response: toCreateOrderResponse(outcome.order), replayed: false }
          : toReplay(outcome.order, attempt);
      } catch (error: unknown) {
        // Only a unique violation is handled here; the kind is read structurally, never from a message.
        if (classifyDatabaseError(error) !== "unique_violation") {
          throw error;
        }
        const winner = await findOrderByIdempotencyKey(this.database, attempt.idempotencyKey);
        if (winner !== null) {
          return toReplay(winner, attempt);
        }
        // Otherwise an order code or a token hash collided: the transaction was rolled back.
      }
    }
    this.logger.warn("order_creation_attempts_exhausted");
    throw new OrderCreationFailedError();
  }

  private async createInTransaction(
    transaction: CreationTransaction,
    attempt: Attempt,
  ): Promise<TransactionOutcome> {
    const customer = await ensureCustomer(transaction, attempt.phoneE164);
    if (customer.isBlocked) {
      throw new CustomerBlockedError();
    }
    await lockCustomerRow(transaction, customer.id);
    // Under the lock, a concurrent identical request has already committed: it is a replay.
    const existing = await findOrderByIdempotencyKey(transaction, attempt.idempotencyKey);
    if (existing !== null) {
      return { kind: "existing", order: existing };
    }
    const now = this.clock.now();
    const recent = await countOrdersSince(transaction, customer.id, getRateLimitWindowStart(now));
    if (isRateLimited(recent)) {
      throw new OrderRateLimitedError();
    }
    const { lines, fee, totalAr } = await priceOrder(transaction, attempt.request);
    const order = await insertOrder(transaction, {
      request: attempt.request,
      idempotencyKey: attempt.idempotencyKey,
      customerId: customer.id,
      orderCode: generateOrderCode(this.randomBytes),
      lines,
      fee,
      totalAr,
      createdAt: now,
    });
    return { kind: "created", order };
  }
}

/**
 * Prices and names from the database, and the delivery fee quoted in the same transaction from
 * the point of the order and the pieces counted here: nothing about money comes from the client.
 * The fee is frozen on the order and never computed again.
 */
async function priceOrder(
  transaction: CreationTransaction,
  request: CreateOrderRequest,
): Promise<PricedOrder> {
  const products = await readProducts(
    transaction,
    request.items.map((item) => item.productId),
  );
  const resolution = resolveOrderLines(request.items, products);
  if (resolution.kind === "unusable") {
    throw new UnavailableProductsError(resolution.productIds);
  }
  const pieces = request.items.reduce((sum, item) => sum + item.quantity, 0);
  const fee = await computeDeliveryQuote(transaction, request.location, pieces);
  const totalAr = computeOrderTotal(resolution.lines, fee.feeAr);
  if (!doesAmountFitColumn(totalAr)) {
    throw new OrderTooLargeError();
  }
  return { lines: resolution.lines, fee, totalAr };
}

function toReplay(stored: StoredOrder, attempt: Attempt): CreateOrderResult {
  if (!matchesStoredOrder(stored, attempt.request, attempt.phoneE164)) {
    throw new IdempotencyConflictError();
  }
  return { response: toCreateOrderResponse(stored), replayed: true };
}
