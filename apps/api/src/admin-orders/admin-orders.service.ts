import { Inject, Injectable } from "@nestjs/common";
import {
  DEFAULT_REJECTION_REASON,
  DELIVERY_FAILED_REASON,
  SHOP_CANCELLATION_REASON,
  canTransition,
  dayInTimeZone,
  encodeOrderCursor,
  isDeliveryDateInWindow,
} from "@entana/contracts";
import type {
  AdminOrderDetail,
  AdminOrderListQuery,
  AdminOrderListResponse,
  InstanceConfig,
  StatusTransitionRequest,
} from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { z } from "zod";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { RequestValidationError } from "../errors/request-body/request-validation-error.js";
import { INSTANCE_CONFIG } from "../instance/config-token/instance-config.token.js";
import {
  AdminOrderNotFoundError,
  OrderTransitionRefusedError,
} from "./errors/admin-order-errors.js";
import {
  changeStatusIfStatusIs,
  findOrderDetail,
  findOrderPage,
  findOrderStatus,
  requireOrderDetail,
  insertStatusChangedEvent,
} from "./persistence/admin-order-queries.js";
import type { StatusChange } from "./persistence/admin-order-queries.js";
import { toAdminOrderDetail, toAdminOrderSummary } from "./rules/to-admin-order.js";

/** What the service needs from the database client: the PrismaClient fits. */
export type AdminOrderClient = Pick<PrismaClient, "$transaction" | "customerOrder" | "orderEvent">;

// The same shape the validation pipe reports, for a rule that needs today's date: written here,
// never taken from the request.
const OUT_OF_WINDOW_ISSUE = {
  code: "custom",
  message: "The delivery date is out of the allowed window.",
  path: ["deliveryDate"],
} as const;

const orderIdSchema = z.uuid();

@Injectable()
export class AdminOrdersService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: AdminOrderClient,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(INSTANCE_CONFIG) private readonly instance: InstanceConfig,
  ) {}

  async listOrders(query: AdminOrderListQuery): Promise<AdminOrderListResponse> {
    const rows = await findOrderPage(this.database, {
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.cursor === undefined ? {} : { before: query.cursor }),
      limit: query.limit,
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(toAdminOrderSummary),
      nextCursor:
        rows.length > query.limit && last !== undefined ? encodeOrderCursor(last.id) : null,
    };
  }

  /** The order, or AdminOrderNotFoundError for an id that is malformed or unknown. */
  async getOrder(id: string): Promise<AdminOrderDetail> {
    const order = await findOrderDetail(this.database, parseOrderId(id));
    if (order === null) {
      throw new AdminOrderNotFoundError();
    }
    return toAdminOrderDetail(order);
  }

  /**
   * Moves the order one step. The status is changed only if it is still the one that was read, and
   * the event is written in the same transaction: a concurrent change, a customer's cancellation
   * included, leaves no row to update and the answer is the same refusal as a forbidden move.
   */
  async changeStatus(
    id: string,
    request: StatusTransitionRequest,
    adminId: string,
  ): Promise<AdminOrderDetail> {
    const orderId = parseOrderId(id);
    this.assertDeliveryDateAllowed(request);
    const now = this.clock.now();
    return this.database.$transaction(async (transaction) => {
      const from = await findOrderStatus(transaction, orderId);
      if (from === null) {
        throw new AdminOrderNotFoundError();
      }
      if (!canTransition(from, request.to)) {
        throw new OrderTransitionRefusedError();
      }
      const { change, payload } = describeChange(from, request);
      if (!(await changeStatusIfStatusIs(transaction, orderId, change))) {
        throw new OrderTransitionRefusedError();
      }
      await insertStatusChangedEvent(transaction, {
        orderId,
        change,
        adminId,
        payload,
        createdAt: now,
      });
      return toAdminOrderDetail(await requireOrderDetail(transaction, orderId));
    });
  }

  private assertDeliveryDateAllowed(request: StatusTransitionRequest): void {
    if (request.to !== "CONFIRMED") {
      return;
    }
    const today = dayInTimeZone(this.clock.now(), this.instance.timezone);
    if (!isDeliveryDateInWindow(request.deliveryDate, today)) {
      throw new RequestValidationError([OUT_OF_WINDOW_ISSUE]);
    }
  }
}

// A malformed id is the same "not found" as an unknown one, and never reaches the database (a
// uuid column refuses a text that is not one).
function parseOrderId(id: string): string {
  const parsed = orderIdSchema.safeParse(id);
  if (!parsed.success) {
    throw new AdminOrderNotFoundError();
  }
  return parsed.data;
}

/** The columns and the event payload of a move: the reason is the default one when none is given. */
function describeChange(
  from: StatusChange["from"],
  request: StatusTransitionRequest,
): { change: StatusChange; payload: Record<string, string> } {
  switch (request.to) {
    case "CONFIRMED":
      return {
        change: { from, to: "CONFIRMED", deliveryDate: new Date(request.deliveryDate) },
        payload: { deliveryDate: request.deliveryDate },
      };
    case "REJECTED": {
      const reason = request.reason ?? DEFAULT_REJECTION_REASON;
      return { change: { from, to: "REJECTED", statusReason: reason }, payload: { reason } };
    }
    case "CANCELLED": {
      const reason = request.reason ?? SHOP_CANCELLATION_REASON;
      return { change: { from, to: "CANCELLED", statusReason: reason }, payload: { reason } };
    }
    case "FAILED":
      return {
        change: { from, to: "FAILED", statusReason: DELIVERY_FAILED_REASON },
        payload: { reason: DELIVERY_FAILED_REASON },
      };
    case "OUT_FOR_DELIVERY":
      return { change: { from, to: "OUT_FOR_DELIVERY" }, payload: {} };
    case "DELIVERED":
      return { change: { from, to: "DELIVERED" }, payload: {} };
  }
}
