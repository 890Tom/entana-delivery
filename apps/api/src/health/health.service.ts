import { Inject, Injectable } from "@nestjs/common";
import type { HealthResponse } from "@entana/contracts";
import { APP_INFO } from "../app-info/app-info.js";
import type { AppInfo } from "../app-info/app-info.js";
import { CLOCK } from "../clock/clock.js";
import type { Clock } from "../clock/clock.js";

const MILLISECONDS_PER_SECOND = 1000;

@Injectable()
export class HealthService {
  private readonly startedAtMs: number;

  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_INFO) private readonly appInfo: AppInfo,
  ) {
    this.startedAtMs = clock.now().getTime();
  }

  /** Liveness only: the process is up and can answer. No dependency is checked. */
  check(): HealthResponse {
    const uptimeMs = this.clock.now().getTime() - this.startedAtMs;
    return {
      status: "ok",
      service: this.appInfo.name,
      version: this.appInfo.version,
      uptimeSeconds: Math.floor(uptimeMs / MILLISECONDS_PER_SECOND),
    };
  }
}
