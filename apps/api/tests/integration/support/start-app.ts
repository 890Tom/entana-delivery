import type { DestinationStream } from "pino";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module.js";
import type { AppConfig } from "../../../src/config/app-config.js";
import {
  NEST_APPLICATION_OPTIONS,
  configureApplication,
} from "../../../src/configure-application.js";
import { FailureCasesModule } from "./failure-cases.module.js";

/**
 * The real application module and the production configuration, with its own database client
 * (no override), plus the routes of this suite that run real operations.
 */
export async function startAppWithFailureCases(
  config: AppConfig,
  logDestination: DestinationStream,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, logDestination), FailureCasesModule.register(config)],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...NEST_APPLICATION_OPTIONS,
  });
  configureApplication(app, config);
  await app.init();
  return app;
}
