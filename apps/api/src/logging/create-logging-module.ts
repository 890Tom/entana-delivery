import type { DynamicModule } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import type { DestinationStream } from "pino";
import type { AppConfig } from "../config/app-config.js";
import { buildPinoHttpOptions } from "./pino-http-options.js";

/** Structured logging with the recommended Nest integration for pino (nestjs-pino). */
export function createLoggingModule(
  config: AppConfig,
  destination?: DestinationStream,
): DynamicModule {
  const options = buildPinoHttpOptions(config);
  return LoggerModule.forRoot({ pinoHttp: destination ? [options, destination] : options });
}
