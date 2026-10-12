import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { TRACKING_TOKEN_HEADER } from "@entana/contracts";
import { ADMIN_SECURITY_SCHEME } from "../admin-auth/http/admin-openapi.js";
import { sessionCookieSettings } from "../admin-auth/http/session-cookie.js";
import type { AppConfig } from "../config/app-config.js";
import { TRACKING_SECURITY_SCHEME } from "../tracking/http/tracking-openapi.js";
import { readAppInfo } from "../app-info/app-info.js";

const DOCS_PATH = "api/docs";

export function setupSwagger(app: NestExpressApplication, config: AppConfig): void {
  const document = new DocumentBuilder()
    .setTitle("Entana Delivery API")
    .setDescription("Ordering and delivery for a small local business.")
    .setVersion(readAppInfo().version)
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: TRACKING_TOKEN_HEADER,
        description: "The tracking token of an order (43 characters), never in the path.",
      },
      TRACKING_SECURITY_SCHEME,
    )
    .addCookieAuth(
      sessionCookieSettings(config.isAdminCookieSecure).name,
      { type: "apiKey", in: "cookie", description: "The session of the administration." },
      ADMIN_SECURITY_SCHEME,
    )
    .build();
  // Created on first request rather than at startup. The path is not prefixed by `api`.
  SwaggerModule.setup(DOCS_PATH, app, () => SwaggerModule.createDocument(app, document));
}
