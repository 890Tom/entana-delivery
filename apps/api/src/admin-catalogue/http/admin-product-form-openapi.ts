import { applyDecorators } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
} from "@nestjs/swagger";
import { adminProductSchema, problemDetailsSchema } from "@entana/contracts";
import { ADMIN_SECURITY_SCHEME } from "../../admin-auth/http/admin-openapi.js";

type Problem = readonly [number, string];

const COMMON: readonly Problem[] = [
  [401, "No valid session. The same answer for every reason."],
  [403, "The origin of a request that changes something is not allowed."],
  [500, "An unexpected error. The body is generic."],
  [503, "The database is unreachable."],
];
const NOT_FOUND: Problem = [404, "No product for this id. The same answer for a malformed id."];
const INVALID_BODY: Problem = [
  400,
  "Invalid body. Lists the invalid fields only, never their values.",
];
const NOT_PUBLISHABLE: Problem = [
  422,
  "`product_not_publishable`: retired:false needs a photo and its alternative text.",
];
const SKU_TAKEN: Problem = [409, "`sku_taken`: another product has this sku (case ignored)."];

const documentProblems = (problems: readonly Problem[]): MethodDecorator =>
  applyDecorators(
    ...problems.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

const CREATE_FIELDS = {
  name: { type: "string", minLength: 1, maxLength: 60 },
  priceAr: { type: "integer", minimum: 1, maximum: 1_000_000 },
  sku: { type: "string", description: "Trimmed and upper-cased: 2 to 20 of A-Z, 0-9 and dashes." },
  description: { type: "string", maxLength: 120, description: "Empty clears it." },
  imageAlt: { type: "string", minLength: 1, maxLength: 150 },
  available: { type: "boolean" },
} as const;
const UPDATE_FIELDS = { ...CREATE_FIELDS, retired: { type: "boolean" } } as const;

export const documentCreateProduct = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Create a product",
      description:
        "At the end of the list, always retired (there is no `retired` field): a product " +
        "becomes visible only after its photo, with PATCH `retired: false`. `available` " +
        "defaults to true.",
      operationId: "createAdminProduct",
    }),
    ApiBody({
      schema: {
        type: "object",
        required: ["name", "priceAr", "sku"],
        additionalProperties: false,
        properties: CREATE_FIELDS,
      },
    }),
    ApiCreatedResponse({ description: "The product.", standardSchema: adminProductSchema }),
    documentProblems([INVALID_BODY, SKU_TAKEN, [415, "Not application/json."], ...COMMON]),
  );

export const documentUpdateProduct = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiParam({ name: "id", description: "The id of the product (a uuid)." }),
    ApiOperation({
      summary: "Change some fields of a product",
      description:
        "At least one field. One transaction, one audit entry per real change, nothing written " +
        "when no value changes. `retired: false` on a retired product restores it: unavailable " +
        "and last, unless `available` is sent too.",
      operationId: "updateAdminProduct",
    }),
    ApiBody({
      schema: {
        type: "object",
        minProperties: 1,
        additionalProperties: false,
        properties: UPDATE_FIELDS,
      },
    }),
    ApiOkResponse({ description: "The product.", standardSchema: adminProductSchema }),
    documentProblems([
      INVALID_BODY,
      NOT_FOUND,
      SKU_TAKEN,
      NOT_PUBLISHABLE,
      [415, "Not application/json."],
      ...COMMON,
    ]),
  );

export const documentReplacePhoto = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiParam({ name: "id", description: "The id of the product (a uuid)." }),
    ApiOperation({
      summary: "Send or replace the photo of a product",
      description:
        "One multipart file named `photo`: JPEG, PNG or WebP (by content), at most 10 MB and 40 " +
        "megapixels, short side at least 800 px. Stored as one square WebP of at most 1000 px " +
        "(never enlarged), without metadata. The alternative text must be set first.",
      operationId: "replaceAdminProductPhoto",
    }),
    ApiConsumes("multipart/form-data"),
    ApiBody({
      schema: {
        type: "object",
        required: ["photo"],
        properties: { photo: { type: "string", format: "binary" } },
      },
    }),
    ApiOkResponse({ description: "The product.", standardSchema: adminProductSchema }),
    documentProblems([
      [400, "No `photo` file, or another field."],
      NOT_FOUND,
      [413, "`photo_too_large`: over 10 MB."],
      [415, "`photo_invalid`: not a JPEG, PNG or WebP image, or the body is not multipart."],
      [
        422,
        "`photo_too_small`, `photo_alt_required`, or `photo_invalid` (corrupt, over 40 megapixels).",
      ],
      ...COMMON,
    ]),
  );
