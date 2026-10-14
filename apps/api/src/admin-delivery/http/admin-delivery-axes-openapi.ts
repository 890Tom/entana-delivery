import { applyDecorators } from "@nestjs/common";
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import {
  DEFAULT_PLACE_RADIUS_M,
  DELIVERY_NAME_MAX_LENGTH,
  MAX_PLACES_PER_AXIS,
  PLACE_RADIUS_MAX_M,
  PLACE_RADIUS_MIN_M,
  adminDeliveryAxisListResponseSchema,
  adminDeliveryAxisSchema,
  problemDetailsSchema,
} from "@entana/contracts";
import { ADMIN_SECURITY_SCHEME } from "../../admin-auth/http/admin-openapi.js";

type Problem = readonly [number, string];

const COMMON: readonly Problem[] = [
  [401, "No valid session. The same answer for every reason."],
  [403, "The origin of a request that changes something is not allowed."],
  [500, "An unexpected error. The body is generic."],
  [503, "The database is unreachable."],
];
const NOT_FOUND: Problem = [404, "No axis for this id. The same answer for a malformed id."];
const INVALID_BODY: Problem = [
  400,
  "Invalid body. Lists the invalid fields only, never their values.",
];
const UNSUPPORTED_TYPE: Problem = [415, "Not application/json."];
const AXIS_NAME_TAKEN: Problem = [
  409,
  "`delivery_axis_name_taken` or `delivery_place_name_taken`: names are unique without regard " +
    "to case, a new place included, also within the body.",
];
const PLACE_UNAVAILABLE: Problem = [
  422,
  "`delivery_place_unavailable`: a `placeId` is unknown, or inactive and not already in the axis.",
];

const documentProblems = (problems: readonly Problem[]): MethodDecorator =>
  applyDecorators(
    ...problems.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

const ID_PARAM = ApiParam({ name: "id", description: "The id of the axis (a uuid)." });

const NAME = { type: "string", minLength: 1, maxLength: DELIVERY_NAME_MAX_LENGTH } as const;
const SAVE_BODY = ApiBody({
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["name", "active", "places"],
    properties: {
      name: NAME,
      active: { type: "boolean" },
      places: {
        type: "array",
        minItems: 1,
        maxItems: MAX_PLACES_PER_AXIS,
        description:
          "In the order along the axis. Each item is `{ placeId }` (an existing active place, " +
          "listed once) or a new place.",
        items: {
          oneOf: [
            {
              type: "object",
              additionalProperties: false,
              required: ["placeId"],
              properties: { placeId: { type: "string", format: "uuid" } },
            },
            {
              type: "object",
              additionalProperties: false,
              required: ["name", "latitude", "longitude"],
              properties: {
                name: NAME,
                latitude: { type: "number", minimum: -90, maximum: 90 },
                longitude: { type: "number", minimum: -180, maximum: 180 },
                radiusM: {
                  type: "integer",
                  minimum: PLACE_RADIUS_MIN_M,
                  maximum: PLACE_RADIUS_MAX_M,
                  default: DEFAULT_PLACE_RADIUS_M,
                },
              },
            },
          ],
        },
      },
    },
  },
});

export const documentCreateDeliveryAxis = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Create a delivery axis",
      description:
        "The axis takes the last rank and the smallest free `colorKey`; its places get the " +
        "positions 1..n in the order received, and the new places are created with it, all in " +
        "one transaction. Audit: `delivery_axis.created` and one `delivery_place.created` per " +
        "new place (ids only).",
      operationId: "createAdminDeliveryAxis",
    }),
    SAVE_BODY,
    ApiCreatedResponse({ description: "The axis.", standardSchema: adminDeliveryAxisSchema }),
    documentProblems([
      INVALID_BODY,
      AXIS_NAME_TAKEN,
      [422, "`delivery_axis_limit_reached` or `delivery_place_unavailable`."],
      UNSUPPORTED_TYPE,
      ...COMMON,
    ]),
  );

export const documentReplaceDeliveryAxis = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Replace the name, the state and the places of an axis",
      description:
        "The list of places replaces the old one, positions renumbered 1..n. A place that leaves " +
        "the axis is never removed. Rank and colour are kept. Audit: `delivery_axis.updated` " +
        "with the changed fields (`name`, `active`, `places`); nothing is written when nothing " +
        "changes.",
      operationId: "replaceAdminDeliveryAxis",
    }),
    SAVE_BODY,
    ApiOkResponse({ description: "The axis.", standardSchema: adminDeliveryAxisSchema }),
    documentProblems([
      INVALID_BODY,
      NOT_FOUND,
      AXIS_NAME_TAKEN,
      PLACE_UNAVAILABLE,
      UNSUPPORTED_TYPE,
      ...COMMON,
    ]),
  );

export const documentReorderDeliveryAxes = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Reorder the delivery axes",
      description:
        "`ids` holds every axis exactly once, inactive ones included. The ranks become 1..n in " +
        "that order. One `delivery_axis.reordered` entry per axis whose rank changes.",
      operationId: "reorderAdminDeliveryAxes",
    }),
    ApiBody({
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["ids"],
        properties: { ids: { type: "array", items: { type: "string", format: "uuid" } } },
      },
    }),
    ApiOkResponse({
      description: "The axes, by their new rank.",
      standardSchema: adminDeliveryAxisListResponseSchema,
    }),
    documentProblems([
      INVALID_BODY,
      [422, "`delivery_axis_order_mismatch`: not a permutation of every axis."],
      UNSUPPORTED_TYPE,
      ...COMMON,
    ]),
  );

export const documentDeleteDeliveryAxis = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Delete an axis that no order uses",
      description:
        "Removes the axis and its links; the places stay. The colour becomes free again. An axis " +
        "that an order points at answers 409 (`delivery_axis_in_use`): deactivate it instead. " +
        "The audit entry `delivery_axis.deleted` keeps the id only.",
      operationId: "deleteAdminDeliveryAxis",
    }),
    ApiNoContentResponse({ description: "Removed. No body." }),
    documentProblems([
      NOT_FOUND,
      [409, "`delivery_axis_in_use`: at least one order references the axis."],
      ...COMMON,
    ]),
  );
