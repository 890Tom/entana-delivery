import { StandardSchemaValidationPipe, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import type { AppConfig } from "./config/app-config.js";
import { rejectBody } from "./errors/body-rejected-error.js";
import { setupSwagger } from "./docs/setup-swagger.js";
import { ProblemDetailsFilter } from "./errors/problem-details.filter.js";
import { toRequestValidationError } from "./errors/request-validation-error.js";

/**
 * Options of the Nest application. The default body parser is off: `configureApplication` installs
 * a JSON parser with the configured size limit instead. `abortOnError` is off so that a failure at
 * startup rejects (main.ts prints its message and exits with code 1) instead of aborting the
 * process with a core dump.
 */
export const NEST_APPLICATION_OPTIONS = { bodyParser: false, abortOnError: false } as const;

const API_PREFIX = "api";
const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * Everything between a created application and a listening one. Shared by `main.ts` and the
 * end-to-end tests, so that the tests exercise the real setup.
 */
export function configureApplication(app: NestExpressApplication, config: AppConfig): void {
  app.useLogger(app.get(Logger));

  // Number of reverse proxies in front of the API (false: none). It decides whether
  // X-Forwarded-For is believed, hence the client address that rate limiting will rely on.
  app.set("trust proxy", config.trustProxy);

  // `upgrade-insecure-requests` makes a browser reload every sub-resource over HTTPS, which breaks
  // the documentation page on a plain-HTTP development server. Production sits behind TLS.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: config.nodeEnv === "production" ? {} : { "upgrade-insecure-requests": null },
      },
    }),
  );
  app.enableCors({ origin: [...config.corsOrigins], maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS });
  // Replaces Nest's default parser (NEST_APPLICATION_OPTIONS) to set the size limit.
  app.useBodyParser("json", { limit: `${String(config.bodyLimitKb)}kb` });
  app.use(rejectBody);

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({ exceptionFactory: toRequestValidationError }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  // SIGTERM and SIGINT close the server and let the requests in progress finish.
  app.enableShutdownHooks();

  if (config.isSwaggerEnabled) {
    setupSwagger(app);
  }
}
