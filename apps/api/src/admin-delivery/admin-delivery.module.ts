import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { AdminDeliveryController } from "./admin-delivery.controller.js";
import { AdminDeliveryAxesService } from "./admin-delivery-axes.service.js";
import { AdminDeliveryService } from "./admin-delivery.service.js";

/**
 * The delivery as the shop administers it: the axes (read and write) and the places (read only),
 * the settings, and the test of an address. Closed by the guard of the administration, which decides on the path.
 */
@Module({})
export class AdminDeliveryModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AdminDeliveryModule,
      imports: [DatabaseModule.register(config)],
      controllers: [AdminDeliveryController],
      providers: [AdminDeliveryService, AdminDeliveryAxesService],
    };
  }
}
