import {
  applyDecorators,
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  deliveryQuoteRequestSchema,
  deliveryQuoteResponseSchema,
  problemDetailsSchema,
} from "@entana/contracts";
import type { DeliveryQuoteRequest, DeliveryQuoteResponse } from "@entana/contracts";
import { JsonContentTypeGuard } from "../errors/request-body/json-content-type.guard.js";
import { DELIVERY_QUOTE_BODY_SCHEMA } from "./http/delivery-quote-openapi.js";
import { DeliveryQuoteService } from "./delivery-quote.service.js";

// Obviously fake: the null island, not a real address.
const EXAMPLE_REQUEST = { latitude: 0, longitude: 0, pieces: 1 };

const PROBLEM_RESPONSES = [
  [400, "Invalid body. Lists the invalid fields only, never their values."],
  [413, "The body is larger than the limit."],
  [415, "The content type is not application/json."],
  [500, "An unexpected error. The body is generic."],
  [503, "The database is unreachable."],
] as const;

const documentProblems = (): MethodDecorator =>
  applyDecorators(
    ...PROBLEM_RESPONSES.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

@ApiTags("delivery")
@Controller({ path: "delivery", version: "1" })
export class DeliveryQuoteController {
  constructor(private readonly deliveryQuoteService: DeliveryQuoteService) {}

  // A POST, not a GET: the coordinates are personal data and stay out of URLs and access logs.
  @Post("quote")
  @HttpCode(200)
  @UseGuards(JsonContentTypeGuard)
  // The answer depends on the axes and settings of the moment, and on a personal point.
  @Header("Cache-Control", "no-store")
  @ApiOperation({
    summary: "Quote the delivery fee",
    description:
      "Public. The fee the server would apply now to an order of this many pieces at this " +
      "point. Nothing is stored; the order creation computes the fee again.",
    operationId: "quoteDelivery",
  })
  @ApiBody({
    schema: DELIVERY_QUOTE_BODY_SCHEMA,
    examples: { fake: { summary: "Fake values", value: EXAMPLE_REQUEST } },
  })
  @ApiOkResponse({ description: "The quote.", standardSchema: deliveryQuoteResponseSchema })
  @documentProblems()
  quote(
    @Body({ schema: deliveryQuoteRequestSchema }) body: DeliveryQuoteRequest,
  ): Promise<DeliveryQuoteResponse> {
    return this.deliveryQuoteService.quote(body);
  }
}
