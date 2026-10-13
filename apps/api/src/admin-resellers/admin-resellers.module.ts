import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { AdminResellersController } from "./admin-resellers.controller.js";
import { AdminResellersService } from "./admin-resellers.service.js";

/**
 * The resellers (points of sale) as the shop manages them: list, creation, update, verification
 * and removal. Closed by the guard of the administration, which decides on the path.
 */
@Module({})
export class AdminResellersModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AdminResellersModule,
      imports: [DatabaseModule.register(config), ClockModule],
      controllers: [AdminResellersController],
      providers: [AdminResellersService],
    };
  }
}
