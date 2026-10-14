import type { ApiBody } from "@nestjs/swagger";
import { deliveryQuoteRequestSchema } from "@entana/contracts";
import { toJSONSchema } from "zod";

// The body is documented from the shared schema, as for the order creation: Zod's output is a
// valid OpenAPI 3.1 schema, only its TypeScript type is wider than Swagger's, hence the cast,
// which is documentation-only.
type BodySchema = Extract<Parameters<typeof ApiBody>[0], { schema: unknown }>["schema"];

export const DELIVERY_QUOTE_BODY_SCHEMA: BodySchema = toJSONSchema(
  deliveryQuoteRequestSchema,
) as BodySchema;
