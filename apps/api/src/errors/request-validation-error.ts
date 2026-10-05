import type { StandardSchemaValidationPipeOptions } from "@nestjs/common";
import type { FieldError } from "@entana/contracts";

type ValidationIssues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions["exceptionFactory"]>
>[0];

type PathSegment = NonNullable<ValidationIssues[number]["path"]>[number];

/** RFC 6901: "~" and "/" are the two characters that cannot appear as such in a pointer. */
function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function toPointer(path: readonly PathSegment[] = []): string {
  return path
    .map((segment) =>
      escapePointerSegment(String(typeof segment === "object" ? segment.key : segment)),
    )
    .map((segment) => `/${segment}`)
    .join("");
}

/** A request that does not match the schema of its route, with one entry per invalid field. */
export class RequestValidationError extends Error {
  readonly fieldErrors: readonly FieldError[];

  constructor(issues: ValidationIssues) {
    super("The request is invalid.");
    this.name = "RequestValidationError";
    this.fieldErrors = issues.map((issue) => ({
      pointer: toPointer(issue.path),
      detail: issue.message,
    }));
  }
}

/** The `exceptionFactory` of the global validation pipe. */
export function toRequestValidationError(issues: ValidationIssues): RequestValidationError {
  return new RequestValidationError(issues);
}
