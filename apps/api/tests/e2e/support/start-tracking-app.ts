import type { DestinationStream } from "pino";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import type { TrackingResponse } from "@entana/contracts";
import { AppModule } from "../../../src/app.module.js";
import { CLOCK } from "../../../src/clock/clock.js";
import type { Clock } from "../../../src/clock/clock.js";
import type { AppConfig } from "../../../src/config/app-config.js";
import {
  NEST_APPLICATION_OPTIONS,
  configureApplication,
} from "../../../src/configure-application.js";
import { TrackingService } from "../../../src/tracking/tracking.service.js";

/** The two methods of the tracking service that the HTTP layer calls. */
export interface TrackingServiceDouble {
  getTracking(token: string): Promise<TrackingResponse>;
  cancelOrder(token: string): Promise<TrackingResponse>;
}

/** The real application with a double of the tracking service: the layer under test is HTTP. */
export async function startTrackingApp(
  config: AppConfig,
  options: { service: TrackingServiceDouble; clock?: Clock; logs?: DestinationStream },
): Promise<NestExpressApplication> {
  let builder = Test.createTestingModule({
    imports: [AppModule.register(config, options.logs)],
  })
    .overrideProvider(TrackingService)
    .useValue(options.service);
  if (options.clock !== undefined) {
    builder = builder.overrideProvider(CLOCK).useValue(options.clock);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    ...NEST_APPLICATION_OPTIONS,
  });
  configureApplication(app, config);
  await app.listen(0, "127.0.0.1");
  return app;
}
