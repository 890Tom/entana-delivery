import { randomBytes } from "node:crypto";
import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { AddressRateLimiter } from "./rate-limit/address-rate-limiter.js";
import { OrdersController } from "./orders.controller.js";
import { DEFAULT_PHONE_COUNTRY_CODE, ORDER_RANDOM_BYTES, OrdersService } from "./orders.service.js";

/** The order creation: the service, the route and the limit per address. */
@Module({})
export class OrdersModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: OrdersModule,
      imports: [DatabaseModule.register(config), ClockModule],
      controllers: [OrdersController],
      providers: [
        OrdersService,
        AddressRateLimiter,
        // The order code is not a secret, but it must not be predictable: a secure source.
        { provide: ORDER_RANDOM_BYTES, useValue: randomBytes },
        { provide: DEFAULT_PHONE_COUNTRY_CODE, useValue: config.defaultPhoneCountryCode },
      ],
      exports: [OrdersService, AddressRateLimiter],
    };
  }
}
