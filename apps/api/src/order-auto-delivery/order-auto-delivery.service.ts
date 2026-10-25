import { Inject, Injectable } from "@nestjs/common";
import type { InstanceConfig } from "@entana/contracts";
import type { PrismaClient } from "@entana/database";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { INSTANCE_CONFIG } from "../instance/config-token/instance-config.token.js";
import {
  insertSystemStatusEvents,
  moveOverdueOrders,
} from "./persistence/overdue-order-queries.js";
import type { OverdueMove, OverdueOrderDatabase } from "./persistence/overdue-order-queries.js";
import { todayAsDeliveryDate } from "./rules/today-as-delivery-date.js";

/** What the service needs from the database client: the PrismaClient fits. */
type OrderAutoDeliveryClient = Pick<PrismaClient, "$transaction">;

@Injectable()
export class OrderAutoDeliveryService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: OrderAutoDeliveryClient,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(INSTANCE_CONFIG) private readonly instance: Pick<InstanceConfig, "timezone">,
  ) {}

  /**
   * Closes the orders whose delivery day is over and that the shop left open, one legal step at a
   * time: a confirmed order goes out for delivery first, then every order out for delivery is
   * delivered. Both steps and their events are one transaction. Returns how many were delivered.
   */
  async deliverOverdueOrders(): Promise<number> {
    const now = this.clock.now();
    const before = todayAsDeliveryDate(now, this.instance.timezone);
    return this.database.$transaction(async (transaction) => {
      await moveAndRecord(transaction, { from: "CONFIRMED", to: "OUT_FOR_DELIVERY", before }, now);
      const delivered = await moveAndRecord(
        transaction,
        { from: "OUT_FOR_DELIVERY", to: "DELIVERED", before },
        now,
      );
      return delivered.length;
    });
  }
}

/** One step: the orders moved, then one event for each, at the same instant. */
async function moveAndRecord(
  transaction: OverdueOrderDatabase,
  move: OverdueMove,
  createdAt: Date,
): Promise<readonly string[]> {
  const orderIds = await moveOverdueOrders(transaction, move);
  await insertSystemStatusEvents(transaction, { ...move, orderIds, createdAt });
  return orderIds;
}
