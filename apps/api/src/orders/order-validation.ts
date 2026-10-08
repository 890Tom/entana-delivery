import { Injectable, createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { PipeTransform } from "@nestjs/common";
import { createOrderRequestSchema, idempotencyKeySchema } from "@entana/contracts";
import type { CreateOrderRequest } from "@entana/contracts";
import { RequestValidationError } from "../errors/request-validation-error.js";
import { INVALID_VALUE_DETAIL } from "./order-failure.js";

type Issues = ConstructorParameters<typeof RequestValidationError>[0];
type IssuePath = NonNullable<Issues[number]["path"]>;

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
const IDEMPOTENCY_KEY_POINTER_PATH = ["headers", "idempotency-key"] as const;

// The default message of a schema can repeat what the client sent (Zod lists the unknown keys of
// a strict object by name), so only the path survives: it comes from the structure of the
// schema, or from an array index, never from a key the client chose (an unknown key is reported
// on its parent). One entry per field.
function toFixedIssues(paths: readonly (IssuePath | undefined)[]): Issues {
  const seen = new Set<string>();
  const issues: Issues[number][] = [];
  for (const path of paths) {
    const identity = JSON.stringify(path ?? []);
    if (!seen.has(identity)) {
      seen.add(identity);
      issues.push({ message: INVALID_VALUE_DETAIL, path });
    }
  }
  return issues;
}

/**
 * Validates the body of an order creation with the shared schema and answers with fixed texts
 * only. It is used on the parameter instead of the global validation pipe, whose messages can
 * repeat what the client sent. It does not remove a `__proto__` key before validating (the global
 * pipe does): the strict schema must see it and refuse the request.
 */
@Injectable()
export class CreateOrderBodyPipe implements PipeTransform<unknown, CreateOrderRequest> {
  transform(value: unknown): CreateOrderRequest {
    const result = createOrderRequestSchema.safeParse(value);
    if (!result.success) {
      throw new RequestValidationError(toFixedIssues(result.error.issues.map((i) => i.path)));
    }
    return result.data;
  }
}

/** The `Idempotency-Key` header: required, one value, a uuid. The answer names only the header. */
@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const result = idempotencyKeySchema.safeParse(value);
    if (!result.success) {
      throw new RequestValidationError(toFixedIssues([IDEMPOTENCY_KEY_POINTER_PATH]));
    }
    return result.data;
  }
}

/**
 * The raw value of the header: a string, or the several values joined by ", " when the header is
 * sent twice (Node joins them), which the uuid check then refuses. Pass IdempotencyKeyPipe to it.
 */
export const idempotencyKeyHeader = createParamDecorator(
  (_data: unknown, context: ExecutionContext): unknown =>
    context.switchToHttp().getRequest<Request>().headers["idempotency-key"],
);
