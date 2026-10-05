import type { DestinationStream } from "pino";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module.js";
import type { AppConfig } from "../../../src/config/app-config.js";
import {
  NEST_APPLICATION_OPTIONS,
  configureApplication,
} from "../../../src/configure-application.js";
import { createApplication } from "../../../src/create-application.js";
import { ProbeModule } from "./probe.module.js";

/** The application exactly as `main.ts` builds it, initialised but not listening. */
export async function startRealApp(
  config: AppConfig,
  logDestination?: DestinationStream,
): Promise<NestExpressApplication> {
  const app = await createApplication(config, logDestination);
  await app.init();
  return app;
}

/** The real application module and the same configuration, plus the test-only probe routes. */
export async function startAppWithProbe(
  config: AppConfig,
  logDestination?: DestinationStream,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, logDestination), ProbeModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...NEST_APPLICATION_OPTIONS,
  });
  configureApplication(app, config);
  await app.init();
  return app;
}
