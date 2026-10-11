import { Inject, Injectable } from "@nestjs/common";
import { isCancellableStatus, isFinalStatus, isTrackingExpired } from "@entana/contracts";
import type { TrackingResponse } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { hashTrackingToken } from "../orders/rules/hash-tracking-token.js";
import { OrderNotCancellableError, TrackingNotFoundError } from "./errors/tracking-errors.js";
import {
  cancelIfStatusIs,
  findOrderByTokenHash,
  findStatusReachedAt,
  insertCancellationEvent,
} from "./persistence/tracking-queries.js";
import type { StoredTrackedOrder, TrackingReader } from "./persistence/tracking-queries.js";
import { CUSTOMER_CANCELLATION_REASON, toTrackingView } from "./rules/to-tracking-view.js";

/** What the service needs from the database client: the PrismaClient fits. */
export type TrackingDatabase = Pick<PrismaClient, "$transaction" | "customerOrder" | "orderEvent">;

/**
 * A concurrent change by the shop can invalidate the status that was read. Statuses only move
 * forward, one step at a time, so a few reads are always enough.
 */
const MAX_CANCEL_ATTEMPTS = 3;

@Injectable()
export class TrackingService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: TrackingDatabase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The view of the order the token belongs to, or TrackingNotFoundError for any other case. */
  async getTracking(token: string): Promise<TrackingResponse> {
    return toTrackingView(await this.findReadableOrder(this.database, token));
  }

  /**
   * Cancels the order while it is NEW or CONFIRMED. Idempotent for an order already cancelled.
   * Atomic: the status is changed only if it is still the one that was read, and the event is
   * written in the same transaction, so a decision of the shop is never overwritten.
   */
  async cancelOrder(token: string): Promise<TrackingResponse> {
    for (let attempt = 1; attempt <= MAX_CANCEL_ATTEMPTS; attempt += 1) {
      const view = await this.database.$transaction((transaction) =>
        this.tryCancel(transaction, token),
      );
      if (view !== undefined) {
        return view;
      }
    }
    throw new OrderNotCancellableError();
  }

  /** `undefined` when the status changed between the read and the write: read again. */
  private async tryCancel(
    transaction: TrackingReader,
    token: string,
  ): Promise<TrackingResponse | undefined> {
    const order = await this.findReadableOrder(transaction, token);
    if (order.status === "CANCELLED") {
      return toTrackingView(order);
    }
    if (!isCancellableStatus(order.status)) {
      throw new OrderNotCancellableError();
    }
    const isChanged = await cancelIfStatusIs(
      transaction,
      order.id,
      order.status,
      CUSTOMER_CANCELLATION_REASON,
    );
    if (!isChanged) {
      return undefined;
    }
    await insertCancellationEvent(transaction, order, order.status, this.clock.now());
    return toTrackingView({
      ...order,
      status: "CANCELLED",
      statusReason: CUSTOMER_CANCELLATION_REASON,
    });
  }

  private async findReadableOrder(
    database: TrackingReader,
    token: string,
  ): Promise<StoredTrackedOrder> {
    // The database compares hashes: the token is never compared in memory.
    const order = await findOrderByTokenHash(database, hashTrackingToken(token));
    if (order === null) {
      throw new TrackingNotFoundError();
    }
    if (isFinalStatus(order.status)) {
      // Without an event (an order that predates them) the creation date is the safest instant.
      const reachedAt =
        (await findStatusReachedAt(database, order.id, order.status)) ?? order.createdAt;
      if (isTrackingExpired(order.status, reachedAt, this.clock.now())) {
        throw new TrackingNotFoundError();
      }
    }
    return order;
  }
}
