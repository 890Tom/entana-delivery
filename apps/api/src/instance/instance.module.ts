import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { AppConfig } from "../config/app-config.js";
import { INSTANCE_CONFIG } from "./instance-config.token.js";
import { InstanceController } from "./instance.controller.js";
import { InstanceService } from "./instance.service.js";
import { loadInstanceConfig } from "./load-instance-config.js";

@Module({})
export class InstanceModule {
  /** Loads the file while the application is built: an invalid file stops the start. */
  static register(config: AppConfig): DynamicModule {
    return {
      module: InstanceModule,
      controllers: [InstanceController],
      providers: [
        InstanceService,
        {
          provide: INSTANCE_CONFIG,
          useFactory: () =>
            loadInstanceConfig({ nodeEnv: config.nodeEnv, path: config.instanceConfigPath }),
        },
      ],
      exports: [INSTANCE_CONFIG],
    };
  }
}
