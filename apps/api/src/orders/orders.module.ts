import { randomBytes } from "node:crypto";
import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { AddressRateLimiter } from "./rate-limit/address-rate-limiter.js";
import { OrdersController } from "./orders.controller.js";
import type { InstanceConfig } from "@entana/contracts";
import { InstanceModule } from "../instance/instance.module.js";
import { INSTANCE_CONFIG } from "../instance/config-token/instance-config.token.js";
import { ORDER_RANDOM_BYTES, OrdersService, PHONE_COUNTRY_CODE } from "./orders.service.js";

/** The order creation: the service, the route and the limit per address. */
@Module({})
export class OrdersModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: OrdersModule,
      imports: [DatabaseModule.register(config), ClockModule, InstanceModule.register(config)],
      controllers: [OrdersController],
      providers: [
        OrdersService,
        AddressRateLimiter,
        // The order code is not a secret, but it must not be predictable: a secure source.
        { provide: ORDER_RANDOM_BYTES, useValue: randomBytes },
        {
          provide: PHONE_COUNTRY_CODE,
          useFactory: (instance: InstanceConfig) => instance.phoneCountryCode,
          inject: [INSTANCE_CONFIG],
        },
      ],
      exports: [OrdersService, AddressRateLimiter],
    };
  }
}
