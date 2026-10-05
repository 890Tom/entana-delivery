import { Module } from "@nestjs/common";
import { APP_INFO, readAppInfo } from "../app-info.js";
import { ClockModule } from "../clock.module.js";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

@Module({
  imports: [ClockModule],
  controllers: [HealthController],
  providers: [HealthService, { provide: APP_INFO, useFactory: readAppInfo }],
})
export class HealthModule {}
