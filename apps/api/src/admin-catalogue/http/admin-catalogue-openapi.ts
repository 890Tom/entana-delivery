import { applyDecorators } from "@nestjs/common";
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import {
  adminProductListResponseSchema,
  adminProductSchema,
  problemDetailsSchema,
} from "@entana/contracts";
import { ADMIN_SECURITY_SCHEME } from "../../admin-auth/http/admin-openapi.js";

type Problem = readonly [number, string];

const UNAUTHENTICATED: Problem = [401, "No valid session. The same answer for every reason."];
const FORBIDDEN: Problem = [403, "The origin of a request that changes something is not allowed."];
const NOT_FOUND: Problem = [404, "No product for this id. The same answer for a malformed id."];
const INVALID_BODY: Problem = [
  400,
  "Invalid body. Lists the invalid fields only, never their values.",
];
const UNSUPPORTED_TYPE: Problem = [415, "The content type is not application/json."];
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

const ID_PARAM = ApiParam({ name: "id", description: "The id of the product (a uuid)." });

export const documentListProducts = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "List every product, retired ones included",
      description:
        "By `position`, then `id`. Not paginated. `retired` is true for a product that is out of " +
        "the public catalogue and cannot be ordered.",
      operationId: "listAdminProducts",
    }),
    ApiOkResponse({ description: "The products.", standardSchema: adminProductListResponseSchema }),
    documentProblems([UNAUTHENTICATED, ...COMMON]),
  );

export const documentChangeAvailability = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Mark a product available or unavailable",
      description:
        "The same value as the current one changes nothing (the date stays, no audit entry) and " +
        "answers 200. A retired product answers 409.",
      operationId: "changeAdminProductAvailability",
    }),
    ApiBody({
      schema: {
        type: "object",
        required: ["available"],
        additionalProperties: false,
        properties: { available: { type: "boolean" } },
      },
    }),
    ApiOkResponse({ description: "The product.", standardSchema: adminProductSchema }),
    documentProblems([
      INVALID_BODY,
      UNAUTHENTICATED,
      FORBIDDEN,
      NOT_FOUND,
      [409, "The product is retired."],
      UNSUPPORTED_TYPE,
      ...COMMON,
    ]),
  );

export const documentRetireProduct = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Retire a product",
      description:
        "Soft: the product leaves the public catalogue and cannot be ordered, the orders that " +
        "hold it are untouched. No body. Already retired: 200, unchanged.",
      operationId: "retireAdminProduct",
    }),
    ApiOkResponse({ description: "The product.", standardSchema: adminProductSchema }),
    documentProblems([UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, ...COMMON]),
  );

export const documentRestoreProduct = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ID_PARAM,
    ApiOperation({
      summary: "Restore a retired product",
      description:
        "The product is active again, unavailable, at the end of the list. No body. Already " +
        "active: 200, unchanged. A product that has no photo cannot be visible: 409.",
      operationId: "restoreAdminProduct",
    }),
    ApiOkResponse({ description: "The product.", standardSchema: adminProductSchema }),
    documentProblems([
      UNAUTHENTICATED,
      FORBIDDEN,
      NOT_FOUND,
      [409, "The product has no photo and cannot be restored."],
      ...COMMON,
    ]),
  );

export const documentReorderProducts = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Set the display order of the products",
      description:
        "`ids` must be exactly the products that are not retired, each once: otherwise 409 and " +
        "nothing is written. Writes the positions 0 to n-1 in one transaction.",
      operationId: "reorderAdminProducts",
    }),
    ApiBody({
      schema: {
        type: "object",
        required: ["ids"],
        additionalProperties: false,
        properties: { ids: { type: "array", items: { type: "string", format: "uuid" } } },
      },
    }),
    ApiOkResponse({
      description: "The whole list, as the list route.",
      standardSchema: adminProductListResponseSchema,
    }),
    documentProblems([
      INVALID_BODY,
      UNAUTHENTICATED,
      FORBIDDEN,
      [409, "The list is not the set of the products that are not retired."],
      UNSUPPORTED_TYPE,
      ...COMMON,
    ]),
  );
