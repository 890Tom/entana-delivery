import type { DestinationStream } from "pino";
import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module.js";
import type { AppConfig } from "../../../src/config/app-config.js";
import {
  NEST_APPLICATION_OPTIONS,
  configureApplication,
} from "../../../src/configure-application.js";
import { createApplication } from "../../../src/create-application.js";
import { DATABASE_CLIENT } from "../../../src/database/database-client.js";
import { READINESS_TIMEOUT_MS } from "../../../src/health/readiness/readiness-timeout.js";
import { DatabaseProbeModule } from "./database-probe.module.js";
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

/** The real application with a shorter readiness timeout, so that a test does not wait 2 seconds. */
export async function startAppWithReadinessTimeout(
  config: AppConfig,
  timeoutMs: number,
  logDestination?: DestinationStream,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, logDestination)],
  })
    .overrideProvider(READINESS_TIMEOUT_MS)
    .useValue(timeoutMs)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...NEST_APPLICATION_OPTIONS,
  });
  configureApplication(app, config);
  await app.init();
  return app;
}

/**
 * The real application module and configuration, with the given database client and the
 * test-only route that runs a query. The client is built by the test (short connection timeout).
 */
export async function startAppWithDatabaseProbe(
  config: AppConfig,
  client: PrismaClient,
  logDestination?: DestinationStream,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config, logDestination), DatabaseProbeModule.register(config)],
  })
    .overrideProvider(DATABASE_CLIENT)
    .useValue(client)
    .compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...NEST_APPLICATION_OPTIONS,
  });
  configureApplication(app, config);
  await app.init();
  return app;
}
