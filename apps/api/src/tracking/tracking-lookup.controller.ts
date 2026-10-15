import { applyDecorators, Body, Controller, HttpCode, Post, UseGuards } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  problemDetailsSchema,
  trackingLookupRequestSchema,
  trackingResponseSchema,
} from "@entana/contracts";
import type { TrackingLookupRequest, TrackingResponse } from "@entana/contracts";
import { JsonContentTypeGuard } from "../errors/request-body/json-content-type.guard.js";
import { EXAMPLE_PHONE } from "../docs/example-phone.js";
import { TrackingService } from "./tracking.service.js";

const PROBLEMS = [
  [400, "Invalid body or phone number. Lists the invalid fields only, never their values."],
  [
    404,
    "No order for this phone number and code. The same answer and the same body for every reason.",
  ],
  [415, "The content type is not application/json."],
  [
    429,
    "Too many requests, from this address or for this phone number. The same body for both, with Retry-After.",
  ],
  [500, "An unexpected error. The body is generic."],
  [503, "The database is unreachable."],
] as const;

const documentProblems = (): MethodDecorator =>
  applyDecorators(
    ...PROBLEMS.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

// A separate controller: the one of the token declares the token as its security scheme.
@ApiTags("tracking")
@Controller({ path: "tracking/lookup", version: "1" })
export class TrackingLookupController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  @HttpCode(200)
  @UseGuards(JsonContentTypeGuard)
  @ApiOperation({
    summary: "Find an order again with the phone number and the order code",
    description:
      "For a customer who lost the tracking token. Read only: the answer is the tracking view with " +
      "canCancel always false, and holds no token. The order code may be typed in lowercase, with " +
      "spaces or hyphens. Limited per address and per phone number.",
    operationId: "lookupTrackedOrder",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["phone", "orderCode"],
      additionalProperties: false,
      properties: { phone: { type: "string" }, orderCode: { type: "string" } },
    },
    examples: {
      fake: { summary: "Fake values", value: { phone: EXAMPLE_PHONE, orderCode: "ABC234" } },
    },
  })
  @ApiOkResponse({
    description: "The order, without any personal data or internal identifier.",
    standardSchema: trackingResponseSchema,
  })
  @documentProblems()
  lookup(
    @Body({ schema: trackingLookupRequestSchema }) body: TrackingLookupRequest,
  ): Promise<TrackingResponse> {
    return this.trackingService.lookupOrder(body);
  }
}
