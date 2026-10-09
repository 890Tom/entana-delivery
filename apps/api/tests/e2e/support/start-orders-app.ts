import type { DestinationStream } from "pino";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../../src/app.module.js";
import { CLOCK } from "../../../src/clock/clock.js";
import type { Clock } from "../../../src/clock/clock.js";
import type { AppConfig } from "../../../src/config/app-config.js";
import {
  NEST_APPLICATION_OPTIONS,
  configureApplication,
} from "../../../src/configure-application.js";
import { OrdersService } from "../../../src/orders/orders.service.js";
import type { CreateOrderResult } from "../../../src/orders/orders.service.js";

/** The only method of the order service that the HTTP layer calls. */
export interface OrderServiceDouble {
  createOrder(request: unknown, idempotencyKey: string): Promise<CreateOrderResult>;
}

/**
 * The real application with its own clock and, when given, a double of the order service. The
 * double lets a test make the service raise each typed error: the layer under test is then the
 * HTTP mapping (controller, filter), not the service, which has its own integration tests.
 */
export async function startOrdersApp(
  config: AppConfig,
  options: { service?: OrderServiceDouble; clock?: Clock; logs?: DestinationStream } = {},
): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule.register(config, options.logs)] });
  if (options.service !== undefined) {
    builder = builder.overrideProvider(OrdersService).useValue(options.service);
  }
  if (options.clock !== undefined) {
    builder = builder.overrideProvider(CLOCK).useValue(options.clock);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...NEST_APPLICATION_OPTIONS,
  });
  configureApplication(app, config);
  // Listening once keeps supertest from adding listeners to the server on each of the many requests.
  await app.listen(0, "127.0.0.1");
  return app;
}
