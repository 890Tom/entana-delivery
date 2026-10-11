import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { TrackingAddressRateLimiter } from "./rate-limit/tracking-address-rate-limiter.js";
import { TrackingController } from "./tracking.controller.js";
import { TrackingService } from "./tracking.service.js";

/** The order tracking by token: reading, cancelling, and the limit per address. */
@Module({})
export class TrackingModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: TrackingModule,
      imports: [DatabaseModule.register(config), ClockModule],
      controllers: [TrackingController],
      providers: [TrackingService, TrackingAddressRateLimiter],
      exports: [TrackingService, TrackingAddressRateLimiter],
    };
  }
}
