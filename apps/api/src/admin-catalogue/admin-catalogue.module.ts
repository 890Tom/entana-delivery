import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { AdminCatalogueController } from "./admin-catalogue.controller.js";
import { AdminCatalogueService } from "./admin-catalogue.service.js";

/**
 * The catalogue as the shop manages it: list, availability, order, retirement and restoration.
 * Closed by the guard of the administration, which decides on the path (`/api/v1/admin`).
 */
@Module({})
export class AdminCatalogueModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AdminCatalogueModule,
      imports: [DatabaseModule.register(config), ClockModule],
      controllers: [AdminCatalogueController],
      providers: [AdminCatalogueService],
    };
  }
}
