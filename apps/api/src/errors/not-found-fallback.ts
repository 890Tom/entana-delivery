import { HttpAdapterHost } from "@nestjs/core";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { OnApplicationBootstrap } from "@nestjs/common";
import type { Application } from "express";
import { sendProblem } from "./send-problem.js";

/**
 * Nest answers an unknown route itself, but only below the global prefix (/api). Anything else
 * (/, /health, /favicon.ico) would get Express's HTML page. This last handler gives those the
 * same problem+json answer. It is added once every route exists, so that it comes after all of
 * them, whatever the order of the modules.
 */
@Injectable()
export class NotFoundFallback implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotFoundFallback.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  onApplicationBootstrap(): void {
    this.adapterHost.httpAdapter.getInstance<Application>().use((request, response) => {
      sendProblem(request, response, new NotFoundException(), this.logger);
    });
  }
}
