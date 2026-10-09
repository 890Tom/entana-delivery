import { Injectable, createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { PipeTransform } from "@nestjs/common";
import { idempotencyKeySchema } from "@entana/contracts";
import { RequestValidationError } from "../../errors/request-body/request-validation-error.js";

export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

// The generic pointer rule refuses a header name (the hyphen of "idempotency-key"), so the header
// is reported through this constant path: it is written here, never taken from the request, and it
// gives the pointer "/headers/idempotencyKey". The code selects the fixed detail; the value of the
// header is never read into the answer.
const IDEMPOTENCY_KEY_ISSUE = {
  code: "invalid_format",
  // Required by the type; never read: the detail comes from the code.
  message: "The Idempotency-Key header is not valid.",
  path: ["headers", "idempotencyKey"],
} as const;

/** The `Idempotency-Key` header: required, one value, a uuid. The answer names only the header. */
@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    const result = idempotencyKeySchema.safeParse(value);
    if (!result.success) {
      throw new RequestValidationError([IDEMPOTENCY_KEY_ISSUE]);
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
