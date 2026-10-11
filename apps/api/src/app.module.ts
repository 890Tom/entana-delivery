import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { DestinationStream } from "pino";
import type { AppConfig } from "./config/app-config.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { NotFoundFallback } from "./errors/problem-details/not-found-fallback.js";
import { HealthModule } from "./health/health.module.js";
import { InstanceModule } from "./instance/instance.module.js";
import { MediaModule } from "./media/media.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { TrackingModule } from "./tracking/tracking.module.js";
import { createLoggingModule } from "./logging/create-logging-module.js";

@Module({})
export class AppModule {
  /** `logDestination` is for tests, which read the logs; the application writes to stdout. */
  static register(config: AppConfig, logDestination?: DestinationStream): DynamicModule {
    return {
      module: AppModule,
      imports: [
        createLoggingModule(config, logDestination),
        HealthModule.register(config),
        CatalogModule.register(config),
        InstanceModule.register(config),
        MediaModule.register(config),
        OrdersModule.register(config),
        TrackingModule.register(config),
      ],
      providers: [NotFoundFallback],
    };
  }
}
