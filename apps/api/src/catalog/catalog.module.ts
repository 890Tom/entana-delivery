import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";

@Module({})
export class CatalogModule {
  /** The catalogue reads the database, so the module imports it visibly. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: CatalogModule,
      imports: [DatabaseModule.register(config)],
      controllers: [CatalogController],
      providers: [CatalogService],
      exports: [CatalogService],
    };
  }
}
