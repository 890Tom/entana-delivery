import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { InstanceModule } from "../instance/instance.module.js";
import { AdminOrdersController } from "./admin-orders.controller.js";
import { AdminOrdersService } from "./admin-orders.service.js";

/**
 * The orders as the shop sees them: list, detail and status change. Closed by the guard of the
 * administration, which decides on the path (`/api/v1/admin`).
 */
@Module({})
export class AdminOrdersModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AdminOrdersModule,
      imports: [DatabaseModule.register(config), ClockModule, InstanceModule.register(config)],
      controllers: [AdminOrdersController],
      providers: [AdminOrdersService],
    };
  }
}
