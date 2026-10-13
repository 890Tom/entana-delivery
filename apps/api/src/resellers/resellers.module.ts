import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { ResellersController } from "./resellers.controller.js";
import { ResellersService } from "./resellers.service.js";

@Module({})
export class ResellersModule {
  /** The list reads the database, so the module imports it visibly. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: ResellersModule,
      imports: [DatabaseModule.register(config)],
      controllers: [ResellersController],
      providers: [ResellersService],
    };
  }
}
