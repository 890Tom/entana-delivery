import { applyDecorators, Controller, Get, Headers, HttpCode, Post } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
  TRACKING_TOKEN_HEADER,
  problemDetailsSchema,
  trackingResponseSchema,
} from "@entana/contracts";
import type { TrackingResponse } from "@entana/contracts";
import { readTrackingToken } from "./http/read-tracking-token.js";
import { TRACKING_SECURITY_SCHEME } from "./http/tracking-openapi.js";
import { TrackingService } from "./tracking.service.js";

// Obviously fake: nothing here looks like a real token.
const EXAMPLE_TOKEN = "A".repeat(43);
const TOKEN_NOTE =
  `The tracking token goes in the ${TRACKING_TOKEN_HEADER} header (example: ` +
  `"${EXAMPLE_TOKEN}"), never in the path or the query string. An absent, malformed, unknown or ` +
  "expired token gets the same 404.";

const NOT_FOUND_PROBLEM = [
  404,
  "No order for this token. The same answer for every reason.",
] as const;
const COMMON_PROBLEMS = [
  [429, "Too many requests from this address, with Retry-After."],
  [500, "An unexpected error. The body is generic."],
  [503, "The database is unreachable."],
] as const;

const documentProblems = (problems: readonly (readonly [number, string])[]): MethodDecorator =>
  applyDecorators(
    ...problems.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

@ApiTags("tracking")
@ApiSecurity(TRACKING_SECURITY_SCHEME)
@Controller({ path: "tracking", version: "1" })
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get()
  @ApiOperation({
    summary: "Read an order by its tracking token",
    description: TOKEN_NOTE,
    operationId: "getTracking",
  })
  @ApiOkResponse({
    description: "The order, without any personal data or internal identifier.",
    standardSchema: trackingResponseSchema,
  })
  @documentProblems([NOT_FOUND_PROBLEM, ...COMMON_PROBLEMS])
  read(@Headers(TRACKING_TOKEN_HEADER) header: unknown): Promise<TrackingResponse> {
    return this.trackingService.getTracking(readTrackingToken(header));
  }

  @Post("cancel")
  @HttpCode(200)
  @ApiOperation({
    summary: "Cancel an order that is not out for delivery yet",
    description:
      `${TOKEN_NOTE} No body. Idempotent: an order already cancelled answers 200 with the ` +
      "same view and no second event.",
    operationId: "cancelTrackedOrder",
  })
  @ApiOkResponse({
    description: "The order after the cancellation (or already cancelled).",
    standardSchema: trackingResponseSchema,
  })
  @documentProblems([
    NOT_FOUND_PROBLEM,
    [409, "The order is out for delivery, delivered, refused or failed."],
    ...COMMON_PROBLEMS,
  ])
  cancel(@Headers(TRACKING_TOKEN_HEADER) header: unknown): Promise<TrackingResponse> {
    return this.trackingService.cancelOrder(readTrackingToken(header));
  }
}
