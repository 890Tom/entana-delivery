import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { MEDIA_ROOT } from "../media/media-root/media-root.token.js";
import { resolveMediaRoot } from "../media/media-root/resolve-media-root.js";
import { AdminProductFormController } from "./admin-product-form.controller.js";
import { AdminProductFormService } from "./admin-product-form.service.js";
import { AdminCatalogueController } from "./admin-catalogue.controller.js";
import { AdminCatalogueService } from "./admin-catalogue.service.js";

/**
 * The catalogue as the shop manages it: list, creation, update, photo, availability, order, retirement and restoration.
 * Closed by the guard of the administration, which decides on the path (`/api/v1/admin`).
 */
@Module({})
export class AdminCatalogueModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AdminCatalogueModule,
      imports: [DatabaseModule.register(config), ClockModule],
      controllers: [AdminCatalogueController, AdminProductFormController],
      providers: [
        AdminCatalogueService,
        AdminProductFormService,
        {
          provide: MEDIA_ROOT,
          useFactory: () => resolveMediaRoot({ nodeEnv: config.nodeEnv, path: config.mediaRoot }),
        },
      ],
    };
  }
}
