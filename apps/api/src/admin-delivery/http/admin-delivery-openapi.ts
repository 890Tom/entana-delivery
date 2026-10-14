import { applyDecorators } from "@nestjs/common";
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import {
  MAX_FREE_DELIVERY_MIN_PIECES,
  PRODUCT_PRICE_MAX_AR,
  adminDeliveryAxisListResponseSchema,
  adminDeliveryPlaceListResponseSchema,
  deliveryResolveResponseSchema,
  deliverySettingsSchema,
  problemDetailsSchema,
} from "@entana/contracts";
import { ADMIN_SECURITY_SCHEME } from "../../admin-auth/http/admin-openapi.js";

type Problem = readonly [number, string];

const COMMON: readonly Problem[] = [
  [401, "No valid session. The same answer for every reason."],
  [500, "An unexpected error. The body is generic."],
  [503, "The database is unreachable."],
];
const INVALID_QUERY: Problem = [
  400,
  "Invalid query. Lists the invalid parameters only, never their values.",
];
const INVALID_BODY: Problem = [
  400,
  "Invalid body. Lists the invalid fields only, never their values.",
];
const FORBIDDEN_ORIGIN: Problem = [
  403,
  "The origin of a request that changes something is not allowed.",
];
const UNSUPPORTED_TYPE: Problem = [415, "Not application/json."];

const documentProblems = (problems: readonly Problem[]): MethodDecorator =>
  applyDecorators(
    ...problems.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

export const documentListDeliveryAxes = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "List the delivery axes",
      description:
        "Every axis, active or not, by `rank`. The places of an axis come in the order of their " +
        "positions, inactive ones included (`active: false`); `alsoIn` lists the other axes " +
        "that hold the place, by rank. Not paginated.",
      operationId: "listAdminDeliveryAxes",
    }),
    ApiOkResponse({
      description: "The axes.",
      standardSchema: adminDeliveryAxisListResponseSchema,
    }),
    documentProblems(COMMON),
  );

export const documentListDeliveryPlaces = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "List the active delivery places",
      description: "The active places by `name`. Not paginated.",
      operationId: "listAdminDeliveryPlaces",
    }),
    ApiOkResponse({
      description: "The places.",
      standardSchema: adminDeliveryPlaceListResponseSchema,
    }),
    documentProblems(COMMON),
  );

export const documentGetDeliverySettings = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Read the delivery settings",
      operationId: "getAdminDeliverySettings",
    }),
    ApiOkResponse({ description: "The settings.", standardSchema: deliverySettingsSchema }),
    documentProblems(COMMON),
  );

export const documentUpdateDeliverySettings = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Change some delivery settings",
      description:
        "At least one field, the others are kept. One transaction; the audit entry " +
        "`delivery_settings.updated` names the changed fields and holds before and after of the " +
        "numbers (never the message). Nothing is written when no value changes.",
      operationId: "updateAdminDeliverySettings",
    }),
    ApiBody({
      schema: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: {
          outOfAxisFeeAr: { type: "integer", minimum: 0, maximum: PRODUCT_PRICE_MAX_AR },
          freeDeliveryMinPieces: {
            type: "integer",
            minimum: 1,
            maximum: MAX_FREE_DELIVERY_MIN_PIECES,
          },
          outOfAxisMessage: { type: "string", minLength: 1, maxLength: 200 },
        },
      },
    }),
    ApiOkResponse({ description: "The settings.", standardSchema: deliverySettingsSchema }),
    documentProblems([INVALID_BODY, FORBIDDEN_ORIGIN, UNSUPPORTED_TYPE, ...COMMON]),
  );

export const documentResolveDelivery = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Test an address",
      description:
        "Applies the delivery rules of the shared contracts to a point: the axis that serves it " +
        "and the fee. Nothing is stored, and the coordinates are not logged.",
      operationId: "resolveAdminDelivery",
    }),
    ApiQuery({
      name: "latitude",
      required: true,
      schema: { type: "number", minimum: -90, maximum: 90 },
    }),
    ApiQuery({
      name: "longitude",
      required: true,
      schema: { type: "number", minimum: -180, maximum: 180 },
    }),
    ApiQuery({
      name: "pieces",
      required: false,
      schema: { type: "integer", minimum: 1, maximum: MAX_FREE_DELIVERY_MIN_PIECES, default: 1 },
    }),
    ApiOkResponse({
      description: "The match (or `null`), the fee and its reason.",
      standardSchema: deliveryResolveResponseSchema,
    }),
    documentProblems([INVALID_QUERY, ...COMMON]),
  );
