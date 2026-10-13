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
  adminResellerListResponseSchema,
  adminResellerSchema,
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
const NOT_FOUND: Problem = [404, "No reseller for this id. The same answer for a malformed id."];
const INVALID_BODY: Problem = [
  400,
  "Invalid body. Lists the invalid fields only, never their values.",
];
const NOT_PUBLISHABLE: Problem = [
  422,
  "`reseller_not_publishable`: a visible reseller needs the consent of its owner.",
];
const UNSUPPORTED_TYPE: Problem = [415, "Not application/json."];

const documentProblems = (problems: readonly Problem[]): MethodDecorator =>
  applyDecorators(
    ...problems.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

const ID_PARAM = ApiParam({ name: "id", description: "The id of the reseller (a uuid)." });

const FIELDS = {
  name: { type: "string", minLength: 1, maxLength: 60 },
  neighborhood: { type: "string", minLength: 1, maxLength: 40 },
  landmark: { type: "string", minLength: 1, maxLength: 120 },
  latitude: { type: "number", minimum: -90, maximum: 90 },
  longitude: { type: "number", minimum: -180, maximum: 180 },
  consentGiven: { type: "boolean", description: "Defaults to false at creation." },
  visible: { type: "boolean", description: "Defaults to false at creation." },
} as const;

export const documentListResellers = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "List every reseller",
      description: "By `neighborhood`, then `name`. Not paginated.",
      operationId: "listAdminResellers",
    }),
    ApiOkResponse({
      description: "The resellers.",
      standardSchema: adminResellerListResponseSchema,
    }),
    documentProblems(COMMON),
  );

export const documentCreateReseller = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Create a reseller",
      description:
        "The position is required. The reseller is verified at its creation. `visible: true` " +
        "needs `consentGiven: true`.",
      operationId: "createAdminReseller",
    }),
    ApiBody({
      schema: {
        type: "object",
        required: ["name", "neighborhood", "landmark", "latitude", "longitude"],
        additionalProperties: false,
        properties: FIELDS,
      },
    }),
    ApiCreatedResponse({ description: "The reseller.", standardSchema: adminResellerSchema }),
    documentProblems([INVALID_BODY, NOT_PUBLISHABLE, UNSUPPORTED_TYPE, ...COMMON]),
  );

export const documentUpdateReseller = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Change some fields of a reseller",
      description:
        "At least one field; `latitude` and `longitude` together. One transaction, one audit " +
        "entry per real change, nothing written when no value changes. The consent of a " +
        "visible reseller is withdrawn only together with `visible: false`.",
      operationId: "updateAdminReseller",
    }),
    ApiBody({
      schema: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: FIELDS,
      },
    }),
    ApiOkResponse({ description: "The reseller.", standardSchema: adminResellerSchema }),
    documentProblems([INVALID_BODY, NOT_FOUND, NOT_PUBLISHABLE, UNSUPPORTED_TYPE, ...COMMON]),
  );

export const documentVerifyReseller = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Mark a reseller as verified now",
      description: "No body. An audit entry is written every time.",
      operationId: "verifyAdminReseller",
    }),
    ApiOkResponse({ description: "The reseller.", standardSchema: adminResellerSchema }),
    documentProblems([NOT_FOUND, ...COMMON]),
  );

export const documentDeleteReseller = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Remove a reseller for good",
      description: "Physical removal. The audit entry keeps the id only.",
      operationId: "deleteAdminReseller",
    }),
    ApiNoContentResponse({ description: "Removed. No body." }),
    documentProblems([NOT_FOUND, ...COMMON]),
  );
