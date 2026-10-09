import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { readAppInfo } from "../app-info/app-info.js";

const DOCS_PATH = "api/docs";

export function setupSwagger(app: NestExpressApplication): void {
  const document = new DocumentBuilder()
    .setTitle("Entana Delivery API")
    .setDescription("Ordering and delivery for a small local business.")
    .setVersion(readAppInfo().version)
    .build();
  // Created on first request rather than at startup. The path is not prefixed by `api`.
  SwaggerModule.setup(DOCS_PATH, app, () => SwaggerModule.createDocument(app, document));
}
