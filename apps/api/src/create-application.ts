import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { DestinationStream } from "pino";
import { AppModule } from "./app.module.js";
import type { AppConfig } from "./config/app-config.js";
import { NEST_APPLICATION_OPTIONS, configureApplication } from "./configure-application.js";

/** The application as it runs in production, ready to listen (or, in tests, to be initialised). */
export async function createApplication(
  config: AppConfig,
  logDestination?: DestinationStream,
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config, logDestination),
    // Logs are buffered until the pino logger is installed (configureApplication).
    { ...NEST_APPLICATION_OPTIONS, bufferLogs: true },
  );
  configureApplication(app, config);
  return app;
}
