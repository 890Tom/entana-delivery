import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { healthResponseSchema, problemDetailsSchema } from "@entana/contracts";
import type { HealthResponse } from "@entana/contracts";
import { HealthService } from "./health.service.js";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  // A cached answer would hide an outage from the monitoring that calls this route.
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Liveness probe", operationId: "getHealth" })
  @ApiOkResponse({ description: "The process is running.", standardSchema: healthResponseSchema })
  @ApiResponse({
    status: "default",
    description: "Problem details (RFC 9457).",
    standardSchema: problemDetailsSchema,
  })
  check(): HealthResponse {
    return this.healthService.check();
  }
}
