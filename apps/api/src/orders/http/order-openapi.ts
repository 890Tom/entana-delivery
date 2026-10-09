import type { ApiBody } from "@nestjs/swagger";
import { createOrderRequestSchema } from "@entana/contracts";
import { toJSONSchema } from "zod";

// The body is documented from the shared schema (one source of truth). The JSON Schema is
// generated here and given to @ApiBody, so that the document does not depend on how Swagger reads
// the parameter metadata that the validation pipe uses. Zod's output is a valid OpenAPI 3.1
// schema; only its TypeScript type is wider than Swagger's, hence the cast, which is
// documentation-only.
type BodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>["schema"];

export const CREATE_ORDER_BODY_SCHEMA: BodySchema = toJSONSchema(
  createOrderRequestSchema,
) as BodySchema;
