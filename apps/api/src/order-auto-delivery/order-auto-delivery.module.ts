import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { InstanceModule } from "../instance/instance.module.js";
import { OrderAutoDeliveryJob } from "./order-auto-delivery.job.js";
import { OrderAutoDeliveryService } from "./order-auto-delivery.service.js";

/**
 * Closes, every morning, the orders whose delivery day is over. Needs `ScheduleModule.forRoot()`
 * in the application, which provides the registry and stops the job on shutdown.
 */
@Module({})
export class OrderAutoDeliveryModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: OrderAutoDeliveryModule,
      imports: [DatabaseModule.register(config), ClockModule, InstanceModule.register(config)],
      providers: [OrderAutoDeliveryService, OrderAutoDeliveryJob],
    };
  }
}
