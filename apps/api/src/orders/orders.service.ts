import { Inject, Injectable, Logger } from "@nestjs/common";
import { computeOrderTotal, generateOrderCode, normalizePhone } from "@entana/contracts";
import type { CreateOrderRequest, CreateOrderResponse } from "@entana/contracts";
import { classifyDatabaseError } from "@entana/database";
import type { PrismaClient } from "@entana/database";
import { CLOCK } from "../clock.js";
import type { Clock } from "../clock.js";
import { DATABASE_CLIENT } from "../database/database-client.js";
import { insertOrder } from "./insert-order.js";
import { matchesStoredOrder, toCreateOrderResponse } from "./matches-stored-order.js";
import type { StoredOrder } from "./matches-stored-order.js";
import {
  CustomerBlockedError,
  IdempotencyConflictError,
  InvalidPhoneError,
  OrderCreationFailedError,
  OrderRateLimitedError,
  OrderTooLargeError,
  UnavailableProductsError,
} from "./order-errors.js";
import {
  doesAmountFitColumn,
  getRateLimitWindowStart,
  isRateLimited,
  MAX_CREATION_ATTEMPTS,
} from "./order-limits.js";
import {
  countOrdersSince,
  ensureCustomer,
  findOrderByIdempotencyKey,
  lockCustomerRow,
  readProducts,
} from "./order-queries.js";
import type { OrderReader } from "./order-queries.js";
import { resolveOrderLines } from "./resolve-order-lines.js";

/** n unpredictable bytes: the API passes node:crypto's `randomBytes`. */
export type RandomBytes = (count: number) => Uint8Array;

export const ORDER_RANDOM_BYTES = Symbol("ORDER_RANDOM_BYTES");
export const DEFAULT_PHONE_COUNTRY_CODE = Symbol("DEFAULT_PHONE_COUNTRY_CODE");

/** What the service needs from the database client: the PrismaClient fits. */
export type OrdersDatabase = Pick<PrismaClient, "$transaction" | "customerOrder">;

export interface CreateOrderResult {
  readonly response: CreateOrderResponse;
  readonly replayed: boolean;
}

type TransactionOutcome =
  | { readonly kind: "created"; readonly order: StoredOrder }
  | { readonly kind: "existing"; readonly order: StoredOrder };

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
    @Inject(DEFAULT_PHONE_COUNTRY_CODE) private readonly defaultPhoneCountryCode: string,
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
    const phoneE164 = normalizePhone(request.phone, this.defaultPhoneCountryCode);
    if (phoneE164 === null) {
      throw new InvalidPhoneError();
    }
    const attempt: Attempt = { request, idempotencyKey, phoneE164 };
    // Before any transaction: a replay takes no lock and writes nothing.
    const existing = await findOrderByIdempotencyKey(this.database, idempotencyKey);
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
    transaction: OrderReader & Pick<PrismaClient, "customerOrder">,
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
    const { lines, totalAr } = await this.priceLines(transaction, attempt.request);
    const order = await insertOrder(transaction, {
      request: attempt.request,
      idempotencyKey: attempt.idempotencyKey,
      customerId: customer.id,
      orderCode: generateOrderCode(this.randomBytes),
      lines,
      totalAr,
      createdAt: now,
    });
    return { kind: "created", order };
  }

  private async priceLines(transaction: OrderReader, request: CreateOrderRequest) {
    const products = await readProducts(
      transaction,
      request.items.map((item) => item.productId),
    );
    const resolution = resolveOrderLines(request.items, products);
    if (resolution.kind === "unusable") {
      throw new UnavailableProductsError(resolution.productIds);
    }
    // Phase 1a: no delivery fee yet.
    const totalAr = computeOrderTotal(resolution.lines, 0);
    if (!doesAmountFitColumn(totalAr)) {
      throw new OrderTooLargeError();
    }
    return { lines: resolution.lines, totalAr };
  }
}

function toReplay(stored: StoredOrder, attempt: Attempt): CreateOrderResult {
  if (!matchesStoredOrder(stored, attempt.request, attempt.phoneE164)) {
    throw new IdempotencyConflictError();
  }
  return { response: toCreateOrderResponse(stored), replayed: true };
}
