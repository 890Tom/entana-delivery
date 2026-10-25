import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { InstanceModule } from "../instance/instance.module.js";
import { PlacesController } from "./places.controller.js";
import { PlacesService } from "./places.service.js";
import { PhotonPlaceSearch } from "./provider/photon-place-search.js";
import { PlacesSearchAddressRateLimiter } from "./rate-limit/places-search-address-rate-limiter.js";

/** The public place search (address suggestions for the maps), with its limit per address. */
@Module({})
export class PlacesModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: PlacesModule,
      imports: [ClockModule, InstanceModule.register(config)],
      controllers: [PlacesController],
      providers: [PlacesService, PhotonPlaceSearch, PlacesSearchAddressRateLimiter],
      exports: [PlacesSearchAddressRateLimiter],
    };
  }
}
