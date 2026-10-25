import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { InstanceConfig } from "@entana/contracts";
import { CronJob } from "cron";
import { INSTANCE_CONFIG } from "../instance/config-token/instance-config.token.js";
import { OrderAutoDeliveryService } from "./order-auto-delivery.service.js";

const JOB_NAME = "order-auto-delivery";
const EVERY_DAY_AT_FOUR = "0 4 * * *";

/**
 * Runs the closing of overdue orders every morning. Registered by hand rather than with `@Cron`: a
 * decorator is read at import time, before the instance configuration that holds the time zone.
 */
@Injectable()
export class OrderAutoDeliveryJob implements OnModuleInit {
  private readonly logger = new Logger(OrderAutoDeliveryJob.name);

  constructor(
    @Inject(SchedulerRegistry) private readonly registry: Pick<SchedulerRegistry, "addCronJob">,
    @Inject(OrderAutoDeliveryService)
    private readonly service: Pick<OrderAutoDeliveryService, "deliverOverdueOrders">,
    @Inject(INSTANCE_CONFIG) private readonly instance: Pick<InstanceConfig, "timezone">,
  ) {}

  onModuleInit(): void {
    const job = CronJob.from({
      cronTime: EVERY_DAY_AT_FOUR,
      onTick: () => this.run(),
      timeZone: this.instance.timezone,
    });
    this.registry.addCronJob(JOB_NAME, job);
    job.start();
  }

  // A failed run is logged and waits for the next morning: it never reaches the process.
  private async run(): Promise<void> {
    try {
      const deliveredCount = await this.service.deliverOverdueOrders();
      this.logger.log(`overdue_orders_delivered count=${String(deliveredCount)}`);
    } catch (error: unknown) {
      this.logger.error(
        `overdue_orders_delivery_failed ${error instanceof Error ? error.name : "unknown"}`,
      );
    }
  }
}
