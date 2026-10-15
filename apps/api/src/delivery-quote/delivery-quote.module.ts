import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { DeliveryQuoteController } from "./delivery-quote.controller.js";
import { DeliveryQuoteService } from "./delivery-quote.service.js";
import { DeliveryZonesController } from "./delivery-zones.controller.js";
import { DeliveryZonesService } from "./delivery-zones.service.js";

/**
 * The public delivery quote and the public zones. The order creation uses `computeDeliveryQuote`
 * of the quote service file.
 */
@Module({})
export class DeliveryQuoteModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: DeliveryQuoteModule,
      imports: [DatabaseModule.register(config)],
      controllers: [DeliveryQuoteController, DeliveryZonesController],
      providers: [DeliveryQuoteService, DeliveryZonesService],
    };
  }
}
