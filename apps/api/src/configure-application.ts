import { StandardSchemaValidationPipe, VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import type { AppConfig } from "./config/app-config.js";
import { AdminLoginAddressRateLimiter } from "./admin-auth/rate-limit/admin-login-address-rate-limiter.js";
import { ADMIN_LOGIN_PATH, ADMIN_PATH } from "./admin-auth/rate-limit/admin-http-limits.js";
import { createAdminOriginMiddleware } from "./admin-auth/http/admin-origin.middleware.js";
import { sessionCookieSettings } from "./admin-auth/http/session-cookie.js";
import { rejectBody } from "./errors/request-body/body-rejected-error.js";
import { AddressRateLimiter } from "./orders/rate-limit/address-rate-limiter.js";
import { ORDER_CREATION_PATH } from "./orders/rate-limit/order-http-limits.js";
import { TrackingAddressRateLimiter } from "./tracking/rate-limit/tracking-address-rate-limiter.js";
import { TrackingLookupAddressRateLimiter } from "./tracking/rate-limit/tracking-lookup-address-rate-limiter.js";
import { TRACKING_LOOKUP_PATH, TRACKING_PATH } from "./tracking/rate-limit/tracking-http-limits.js";
import {
  exceptLookup,
  ignoreRequestBody,
  setTrackingResponseHeaders,
} from "./tracking/http/tracking-middleware.js";
import { rejectPrototypeKey } from "./errors/request-body/reject-prototype-key.js";
import { setupSwagger } from "./docs/setup-swagger.js";
import { ProblemDetailsFilter } from "./errors/problem-details/problem-details.filter.js";
import { toRequestValidationError } from "./errors/request-body/request-validation-error.js";

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
  // Before the body parser: an address over its limit is answered without reading its body.
  app.use(ORDER_CREATION_PATH, app.get(AddressRateLimiter).middleware);
  // The tracking routes: their headers first (every answer carries them, errors included), then
  // their own limit, then the body is set aside, all before the parser. The lookup by phone number
  // and code is the one tracking route with a body and has its own limit: the two steps above do
  // not apply to it.
  app.use(TRACKING_PATH, setTrackingResponseHeaders);
  app.use(TRACKING_LOOKUP_PATH, app.get(TrackingLookupAddressRateLimiter).middleware);
  app.use(TRACKING_PATH, exceptLookup(app.get(TrackingAddressRateLimiter).middleware));
  app.use(TRACKING_PATH, exceptLookup(ignoreRequestBody));
  // The administration: the login has its own limit, then every change must come from an allowed
  // origin. Both answer before the body is read.
  app.use(ADMIN_LOGIN_PATH, app.get(AdminLoginAddressRateLimiter).middleware);
  app.use(
    ADMIN_PATH,
    createAdminOriginMiddleware({
      allowedOrigins: config.adminAllowedOrigins,
      cookie: sessionCookieSettings(config.isAdminCookieSecure),
    }),
  );
  // Replaces Nest's default parser (NEST_APPLICATION_OPTIONS) to set the size limit.
  app.useBodyParser("json", { limit: `${String(config.bodyLimitKb)}kb` });
  app.use(rejectBody);
  // Every route: a "__proto__" key would be removed silently by the validation pipe.
  app.use(rejectPrototypeKey);

  // The media are not part of the API: /media/<folder>/<file>, no prefix and no version.
  app.setGlobalPrefix(API_PREFIX, { exclude: ["media/:folder/:file"] });
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({ exceptionFactory: toRequestValidationError }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  // SIGTERM and SIGINT close the server and let the requests in progress finish.
  app.enableShutdownHooks();

  if (config.isSwaggerEnabled) {
    setupSwagger(app, config);
  }
}
