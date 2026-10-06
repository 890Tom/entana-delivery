import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { problemDetailsSchema, readinessResponseSchema } from "@entana/contracts";
import type { ReadinessResponse } from "@entana/contracts";
import { ReadinessService } from "./readiness.service.js";

@ApiTags("health")
@Controller({ path: "health", version: "1" })
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get("ready")
  // A cached answer would hide an outage from the monitoring that calls this route.
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Readiness probe", operationId: "getReadiness" })
  @ApiOkResponse({
    description: "The API can serve requests.",
    standardSchema: readinessResponseSchema,
  })
  @ApiResponse({
    status: 503,
    description: "The API cannot serve requests yet. The body names no component.",
    standardSchema: problemDetailsSchema,
  })
  @ApiResponse({
    status: "default",
    description: "Problem details (RFC 9457).",
    standardSchema: problemDetailsSchema,
  })
  check(): Promise<ReadinessResponse> {
    return this.readinessService.check();
  }
}
