import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { AppConfig } from "../config/app-config.js";
import { MEDIA_ROOT } from "./media-root.token.js";
import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";
import { resolveMediaRoot } from "./resolve-media-root.js";

@Module({})
export class MediaModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: MediaModule,
      controllers: [MediaController],
      providers: [
        MediaService,
        {
          provide: MEDIA_ROOT,
          useFactory: () => resolveMediaRoot({ nodeEnv: config.nodeEnv, path: config.mediaRoot }),
        },
      ],
    };
  }
}
