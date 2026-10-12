import { applyDecorators } from "@nestjs/common";
import type { ApiBodyOptions } from "@nestjs/swagger";
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import {
  adminOrderDetailSchema,
  MAX_STATUS_REASON_LENGTH,
  adminOrderListResponseSchema,
  adminOrderSummaryResponseSchema,
  problemDetailsSchema,
} from "@entana/contracts";
import { ADMIN_SECURITY_SCHEME } from "../../admin-auth/http/admin-openapi.js";

type Problem = readonly [number, string];

const UNAUTHENTICATED: Problem = [401, "No valid session. The same answer for every reason."];
const NOT_FOUND: Problem = [404, "No order for this id. The same answer for a malformed id."];
const COMMON: readonly Problem[] = [
  [500, "An unexpected error. The body is generic."],
  [503, "The database is unreachable."],
];

const documentProblems = (problems: readonly Problem[]): MethodDecorator =>
  applyDecorators(
    ...problems.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

// The request union written for OpenAPI (the Zod schema is the one that validates).
const TRANSITION_BODY: Extract<ApiBodyOptions, { schema: unknown }>["schema"] = {
  oneOf: [
    {
      type: "object",
      required: ["to", "deliveryDate"],
      additionalProperties: false,
      properties: {
        to: { type: "string", enum: ["CONFIRMED"] },
        deliveryDate: { type: "string", format: "date" },
      },
    },
    {
      type: "object",
      required: ["to"],
      additionalProperties: false,
      properties: {
        to: { type: "string", enum: ["REJECTED", "CANCELLED"] },
        reason: { type: "string", minLength: 1, maxLength: MAX_STATUS_REASON_LENGTH },
      },
    },
    {
      type: "object",
      required: ["to"],
      additionalProperties: false,
      properties: {
        to: { type: "string", enum: ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED"] },
      },
    },
  ],
};

const ID_PARAM = ApiParam({ name: "id", description: "The id of the order (a uuid)." });

export const documentListOrders = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "List the orders, newest first",
      description:
        "Cursor pagination: pass `nextCursor` of a page as `cursor` to read the next one. " +
        "`status` keeps the statuses of a comma separated list. `date` (YYYY-MM-DD, a day of the " +
        "instance time zone) keeps the orders received that day or to be delivered that day. " +
        "`q` (2 to 50 characters) searches the name typed on the order (letters, spaces, `-` and " +
        "`'`, case ignored, accents not) or, when it is only digits, a part of the phone number " +
        "(3 digits at least). `totalCount` counts the orders of the filters, whatever the cursor. " +
        "`limit` is 25 by default, 100 at most.",
      operationId: "listAdminOrders",
    }),
    ApiOkResponse({
      description: "One page of orders.",
      standardSchema: adminOrderListResponseSchema,
    }),
    documentProblems([
      [400, "Invalid query. Lists the invalid parameters only, never their values."],
      UNAUTHENTICATED,
      ...COMMON,
    ]),
  );

export const documentOrdersSummary = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Count the orders to process and the orders received today",
      description:
        "`since` (the id of the newest order already seen) adds `newSince`: the orders NEW " +
        "after it, and the latest of them. Without `since`, `newSince` is absent.",
      operationId: "getAdminOrdersSummary",
    }),
    ApiOkResponse({
      description: "The counters.",
      standardSchema: adminOrderSummaryResponseSchema,
    }),
    documentProblems([
      [400, "Invalid query. Lists the invalid parameters only, never their values."],
      UNAUTHENTICATED,
      ...COMMON,
    ]),
  );

export const documentGetOrder = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Read an order with its lines and its history",
      description: "Never holds the hash of the tracking token.",
      operationId: "getAdminOrder",
    }),
    ApiOkResponse({ description: "The order.", standardSchema: adminOrderDetailSchema }),
    documentProblems([UNAUTHENTICATED, NOT_FOUND, ...COMMON]),
  );

export const documentChangeStatus = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Move an order to its next status",
      description:
        "Allowed: NEW to CONFIRMED (with `deliveryDate`, today to 60 days ahead) or REJECTED, " +
        "CONFIRMED to OUT_FOR_DELIVERY, REJECTED or CANCELLED, OUT_FOR_DELIVERY to DELIVERED or FAILED. " +
        "`reason` is optional for REJECTED and CANCELLED. The same 409 answers a forbidden move, an order " +
        "already in that status and an order changed in between (a cancellation included).",
      operationId: "changeAdminOrderStatus",
    }),
    ApiBody({ schema: TRANSITION_BODY }),
    ApiOkResponse({
      description: "The order after the change.",
      standardSchema: adminOrderDetailSchema,
    }),
    documentProblems([
      [400, "Invalid body. Lists the invalid fields only, never their values."],
      UNAUTHENTICATED,
      [403, "The origin of a request that changes something is not allowed."],
      NOT_FOUND,
      [409, "The order cannot move to this status."],
      [415, "The content type is not application/json."],
      ...COMMON,
    ]),
  );
