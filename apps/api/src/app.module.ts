import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import type { DestinationStream } from "pino";
import type { AppConfig } from "./config/app-config.js";
import { AdminAuthModule } from "./admin-auth/admin-auth.module.js";
import { AdminCatalogueModule } from "./admin-catalogue/admin-catalogue.module.js";
import { AdminOrdersModule } from "./admin-orders/admin-orders.module.js";
import { AdminDeliveryModule } from "./admin-delivery/admin-delivery.module.js";
import { AdminResellersModule } from "./admin-resellers/admin-resellers.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { DeliveryQuoteModule } from "./delivery-quote/delivery-quote.module.js";
import { NotFoundFallback } from "./errors/problem-details/not-found-fallback.js";
import { HealthModule } from "./health/health.module.js";
import { InstanceModule } from "./instance/instance.module.js";
import { MediaModule } from "./media/media.module.js";
import { OrderAutoDeliveryModule } from "./order-auto-delivery/order-auto-delivery.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { ResellersModule } from "./resellers/resellers.module.js";
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
        ResellersModule.register(config),
        DeliveryQuoteModule.register(config),
        InstanceModule.register(config),
        MediaModule.register(config),
        OrdersModule.register(config),
        TrackingModule.register(config),
        AdminAuthModule.register(config),
        AdminOrdersModule.register(config),
        AdminCatalogueModule.register(config),
        AdminResellersModule.register(config),
        AdminDeliveryModule.register(config),
        ScheduleModule.forRoot(),
        OrderAutoDeliveryModule.register(config),
      ],
      providers: [NotFoundFallback],
    };
  }
}
