import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { DestinationStream } from "pino";
import type { AppConfig } from "./config/app-config.js";
import { NotFoundFallback } from "./errors/not-found-fallback.js";
import { HealthModule } from "./health/health.module.js";
import { createLoggingModule } from "./logging/create-logging-module.js";

@Module({})
export class AppModule {
  /** `logDestination` is for tests, which read the logs; the application writes to stdout. */
  static register(config: AppConfig, logDestination?: DestinationStream): DynamicModule {
    return {
      module: AppModule,
      imports: [createLoggingModule(config, logDestination), HealthModule],
      providers: [NotFoundFallback],
    };
  }
}
