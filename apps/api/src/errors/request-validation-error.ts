import type { StandardSchemaValidationPipeOptions } from "@nestjs/common";
import type { FieldError } from "@entana/contracts";

type ValidationIssues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions["exceptionFactory"]>
>[0];

type PathSegment = NonNullable<ValidationIssues[number]["path"]>[number];

/**
 * The detail of a field error, chosen by the code of the Zod issue. The text of an issue is never
 * read: Zod writes keys and values of the request into it. These are plain sentences with
 * nothing taken from the request or the schema.
 */
export const VALIDATION_DETAILS = {
  invalid_type: "This field has the wrong type.",
  too_small: "This field is too small or too short.",
  too_big: "This field is too large or too long.",
  invalid_format: "This field does not have the expected format.",
  invalid_value: "This field is not one of the allowed values.",
  unrecognized_keys: "This object has fields that are not allowed.",
  custom: "This field is not acceptable.",
  default: "This field is invalid.",
} as const;

/** A hostile body cannot make the response grow: no more errors than this are reported. */
const MAX_REPORTED_ERRORS = 20;
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9]{0,40}$/;
const MAX_ARRAY_INDEX = 999;

function isDetailCode(code: unknown): code is Exclude<keyof typeof VALIDATION_DETAILS, "default"> {
  return typeof code === "string" && Object.hasOwn(VALIDATION_DETAILS, code) && code !== "default";
}

// Standard Schema issues carry a message and a path only; Zod's own issues, which are what the
// schemas of this API produce, also carry a `code`. Anything else gets the default detail.
function detailOf(issue: ValidationIssues[number]): string {
  const code: unknown = (issue as { readonly code?: unknown }).code;
  return isDetailCode(code) ? VALIDATION_DETAILS[code] : VALIDATION_DETAILS.default;
}

/** The segment as text when it is safe to show (schema structure or a small index), else undefined. */
function toSafeSegment(segment: PathSegment): string | undefined {
  const key = typeof segment === "object" ? segment.key : segment;
  if (typeof key === "number") {
    return Number.isInteger(key) && key >= 0 && key <= MAX_ARRAY_INDEX ? String(key) : undefined;
  }
  return typeof key === "string" && SAFE_NAME.test(key) ? key : undefined;
}

// A key the client chose (an unknown key, a record key) would put its text in the pointer, so the
// pointer stops at the parent of the first segment that is not safe. The safe names contain no
// "~" or "/", so no escaping is needed. A client-chosen key that has the safe shape (a record key
// of letters and digits) is still shown, so a route must not take a `z.record` whose keys can be
// personal data.
function toPointer(path: readonly PathSegment[] = []): string {
  let pointer = "";
  for (const segment of path) {
    const safe = toSafeSegment(segment);
    if (safe === undefined) {
      break;
    }
    pointer += `/${safe}`;
  }
  return pointer;
}

/** A request that does not match the schema of its route, with one entry per invalid field. */
export class RequestValidationError extends Error {
  readonly fieldErrors: readonly FieldError[];

  constructor(issues: ValidationIssues) {
    super("The request is invalid.");
    this.name = "RequestValidationError";
    this.fieldErrors = issues.slice(0, MAX_REPORTED_ERRORS).map((issue) => ({
      pointer: toPointer(issue.path),
      detail: detailOf(issue),
    }));
  }
}

/** The `exceptionFactory` of the global validation pipe. */
export function toRequestValidationError(issues: ValidationIssues): RequestValidationError {
  return new RequestValidationError(issues);
}
