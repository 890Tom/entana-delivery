import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { InstanceModule } from "../instance/instance.module.js";
import { TrackingAddressRateLimiter } from "./rate-limit/tracking-address-rate-limiter.js";
import { TrackingLookupAddressRateLimiter } from "./rate-limit/tracking-lookup-address-rate-limiter.js";
import { TrackingLookupPhoneRateLimiter } from "./rate-limit/tracking-lookup-phone-rate-limiter.js";
import { TrackingController } from "./tracking.controller.js";
import { TrackingLookupController } from "./tracking-lookup.controller.js";
import { TrackingService } from "./tracking.service.js";

/** The order tracking: by token (read, cancel) and by phone number and code, with their limits. */
@Module({})
export class TrackingModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: TrackingModule,
      imports: [DatabaseModule.register(config), ClockModule, InstanceModule.register(config)],
      controllers: [TrackingController, TrackingLookupController],
      providers: [
        TrackingService,
        TrackingAddressRateLimiter,
        TrackingLookupAddressRateLimiter,
        TrackingLookupPhoneRateLimiter,
      ],
      exports: [TrackingService, TrackingAddressRateLimiter, TrackingLookupAddressRateLimiter],
    };
  }
}
