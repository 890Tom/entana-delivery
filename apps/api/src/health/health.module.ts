import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { APP_INFO, readAppInfo } from "../app-info.js";
import { ClockModule } from "../clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";
import { ReadinessController } from "./readiness.controller.js";
import { ReadinessService } from "./readiness.service.js";
import { DEFAULT_READINESS_TIMEOUT_MS, READINESS_TIMEOUT_MS } from "./readiness-timeout.js";

@Module({})
export class HealthModule {
  /** Liveness needs nothing; readiness needs the database, so the module imports it visibly. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: HealthModule,
      imports: [ClockModule, DatabaseModule.register(config)],
      controllers: [HealthController, ReadinessController],
      providers: [
        HealthService,
        ReadinessService,
        { provide: APP_INFO, useFactory: readAppInfo },
        { provide: READINESS_TIMEOUT_MS, useValue: DEFAULT_READINESS_TIMEOUT_MS },
      ],
    };
  }
}
