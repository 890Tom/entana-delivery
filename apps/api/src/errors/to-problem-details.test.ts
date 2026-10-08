import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  ConflictException,
  MethodNotAllowedException,
  NotAcceptableException,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
  InternalServerErrorException,
} from "@nestjs/common";
import { problemDetailsSchema } from "@entana/contracts";
import { DATABASE_ERROR_KINDS } from "@entana/database";
import { describe, expect, it } from "vitest";
import { fixedDatabaseProblem } from "../../tests/support/fixed-database-problems.js";
import { buildObservedDatabaseError } from "../../tests/support/observed-database-errors.js";
import { toProblemDetails } from "./to-problem-details.js";
import { RequestValidationError, VALIDATION_DETAILS } from "./request-validation-error.js";
import { ServiceNotReadyError } from "./service-not-ready-error.js";

// Zod's own issues, which the pipe receives at run time, carry more than the Standard Schema type.
function zodIssue<T extends object>(fields: T): T {
  return fields;
}

describe("toProblemDetails", () => {
  it("describes a Nest HTTP exception with its status", () => {
    const problem = toProblemDetails(new NotFoundException(), "/api/v1/missing");
    expect(problem).toMatchObject({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      instance: "/api/v1/missing",
    });
  });

  it.each([
    [new BadRequestException("SECRET-A"), 400, "The request is invalid."],
    [new UnauthorizedException("SECRET-A"), 401, "Authentication is required."],
    [new ForbiddenException("SECRET-A"), 403, "This action is not allowed."],
    [
      new NotFoundException("Cannot GET /FAKE-PATH-8841?q=FAKE-QUERY-8841"),
      404,
      "The requested resource was not found.",
    ],
    [new MethodNotAllowedException("SECRET-A"), 405, "This method is not allowed."],
    [new NotAcceptableException("SECRET-A"), 406, "The requested format is not available."],
    [new ConflictException("SECRET-A"), 409, "The request conflicts with the current state."],
    [new PayloadTooLargeException("SECRET-A"), 413, "The request body is too large."],
    [
      new UnsupportedMediaTypeException("SECRET-A"),
      415,
      "The content type of the request is not supported.",
    ],
    [new UnprocessableEntityException("SECRET-A"), 422, "The request could not be processed."],
    [new HttpException("SECRET-A", 429), 429, "Too many requests."],
    [new HttpException("SECRET-A", 499), 499, "The request could not be completed."],
  ])(
    "answers an HTTP exception with a fixed detail chosen by its status (%#)",
    (error, status, detail) => {
      const problem = toProblemDetails(error, "/x");
      expect(problem).toMatchObject({ status, detail });
      expect(JSON.stringify(problem)).not.toMatch(/SECRET-A|FAKE-/);
    },
  );

  it("never reads the message of an HTTP exception with an unlisted status", () => {
    const problem = toProblemDetails(new HttpException("secret 0612345678", 418), "/x");
    expect(problem.detail).toBe("The request could not be completed.");
  });

  it("never reads the response body of an HTTP exception", () => {
    const error = new HttpException({ message: "SECRET-B", extra: "SECRET-B" }, 409);
    expect(JSON.stringify(toProblemDetails(error, "/x"))).not.toContain("SECRET-B");
  });

  it("hides the message of an HTTP exception that is a server error", () => {
    const problem = toProblemDetails(new InternalServerErrorException("db.internal down"), "/x");
    expect(problem).toMatchObject({ status: 500, detail: "An unexpected error occurred." });
  });

  it("always returns something that matches the shared schema", () => {
    for (const error of [new BadRequestException(), new Error("x"), "a string", undefined]) {
      expect(problemDetailsSchema.safeParse(toProblemDetails(error, "/x")).success).toBe(true);
    }
  });

  describe("service not ready", () => {
    it("is a 503 with a fixed text that names no component", () => {
      const problem = toProblemDetails(new ServiceNotReadyError(), "/api/v1/health/ready");
      expect(problem).toEqual({
        type: "about:blank",
        title: "Service Unavailable",
        status: 503,
        detail: "The service is not ready.",
        instance: "/api/v1/health/ready",
      });
    });
  });

  describe("validation errors", () => {
    it("lists the invalid fields as JSON pointers with a fixed detail per code", () => {
      const error = new RequestValidationError([
        zodIssue({ code: "too_small", message: "Too small: 8841", path: ["items", 0, "quantity"] }),
        zodIssue({ code: "invalid_type", message: "Required", path: [{ key: "phone" }] }),
      ]);
      expect(toProblemDetails(error, "/api/v1/orders")).toMatchObject({
        type: "urn:entana:problem:validation-error",
        title: "Bad Request",
        status: 400,
        detail: "The request is invalid.",
        errors: [
          { pointer: "/items/0/quantity", detail: VALIDATION_DETAILS.too_small },
          { pointer: "/phone", detail: VALIDATION_DETAILS.invalid_type },
        ],
      });
    });

    it("never reads the message of an issue", () => {
      const error = new RequestValidationError([
        zodIssue({ code: "custom", message: "SECRET-TEXT" }),
      ]);
      expect(JSON.stringify(toProblemDetails(error, "/x"))).not.toContain("SECRET-TEXT");
    });

    it("uses the default detail for an unknown or missing code", () => {
      const error = new RequestValidationError([
        zodIssue({ code: "invalid_union", message: "m" }),
        zodIssue({ code: "toString", message: "m" }),
        { message: "m" },
      ]);
      expect(toProblemDetails(error, "/x").errors).toEqual([
        { pointer: "", detail: VALIDATION_DETAILS.default },
        { pointer: "", detail: VALIDATION_DETAILS.default },
        { pointer: "", detail: VALIDATION_DETAILS.default },
      ]);
    });

    it("points at the whole body when the issue has no path", () => {
      const error = new RequestValidationError([zodIssue({ code: "invalid_type", message: "m" })]);
      expect(toProblemDetails(error, "/x").errors).toEqual([
        { pointer: "", detail: VALIDATION_DETAILS.invalid_type },
      ]);
    });

    it.each([
      [["a", "b/c", "d"], "/a"],
      [["a", "c~d"], "/a"],
      [["a", "", "b"], "/a"],
      [["1abc"], ""],
      [["a".repeat(42)], ""],
      [["a".repeat(41), "b"], `/${"a".repeat(41)}/b`],
      [["a", -1, "b"], "/a"],
      [["a", 1000, "b"], "/a"],
      [["a", 100_000], "/a"],
      [["a", 1.5], "/a"],
      [["a", Number.NaN], "/a"],
      [["a", Number.POSITIVE_INFINITY], "/a"],
      [["a", { key: 5 }], "/a/5"],
      [["a", 999, "b"], "/a/999/b"],
      [["a", 0], "/a/0"],
      [["a", Symbol("s"), "b"], "/a"],
      [["__proto__"], ""],
      [["a", { key: "FAKE-KEY-8841" }], "/a"],
      [["a", { key: "okKey" }], "/a/okKey"],
    ])("builds a safe pointer from %j", (path, pointer) => {
      const error = new RequestValidationError([
        zodIssue({ code: "invalid_type", message: "m", path }),
      ]);
      expect(toProblemDetails(error, "/x").errors?.[0]?.pointer).toBe(pointer);
    });

    it("points at the parent object for unrecognized keys, whatever the keys", () => {
      const error = new RequestValidationError([
        zodIssue({ code: "unrecognized_keys", keys: ["FAKE-KEY-8841"], message: "m", path: ["a"] }),
      ]);
      expect(toProblemDetails(error, "/x").errors).toEqual([
        { pointer: "/a", detail: VALIDATION_DETAILS.unrecognized_keys },
      ]);
    });

    it.each([
      [19, 19],
      [20, 20],
      [21, 20],
      [5000, 20],
    ])("reports %i issues as %i errors, the first ones", (count, reported) => {
      const issues = Array.from({ length: count }, (_, index) =>
        zodIssue({ code: "custom", message: "m", path: [index] }),
      );
      const pointers = toProblemDetails(new RequestValidationError(issues), "/x").errors?.map(
        (error) => error.pointer,
      );
      expect(pointers).toHaveLength(reported);
      expect(pointers?.[reported - 1]).toBe(`/${String(reported - 1)}`);
    });

    it("has a distinct plain sentence for each code", () => {
      const details = Object.values(VALIDATION_DETAILS);
      expect(new Set(details).size).toBe(details.length);
      for (const detail of details) {
        expect(detail).toMatch(/^[A-Z][A-Za-z ,'-]+\.$/);
      }
    });
  });

  describe("errors raised by the HTTP layer (body parser)", () => {
    it("maps a too-large body to 413 without repeating the parser message", () => {
      const error = Object.assign(new Error("request entity too large: 5000 > 100"), {
        status: 413,
      });
      expect(toProblemDetails(error, "/x")).toMatchObject({
        title: "Payload Too Large",
        status: 413,
        detail: "The request body is too large.",
      });
    });

    it("maps an unsupported content type to 415 without repeating the parser message", () => {
      const error = Object.assign(new Error("unsupported charset secret-charset"), { status: 415 });
      expect(toProblemDetails(error, "/x")).toMatchObject({
        status: 415,
        detail: "The content type of the request is not supported.",
      });
    });

    it("maps malformed JSON to 400 without repeating the parser message", () => {
      const error = Object.assign(new SyntaxError("Unexpected token 'x' in secret-field"), {
        status: 400,
        type: "entity.parse.failed",
      });
      const problem = toProblemDetails(error, "/x");
      expect(problem).toMatchObject({ status: 400, detail: "The request body is not valid JSON." });
    });

    it("uses the generic title for a status that has no standard name", () => {
      const problem = toProblemDetails(Object.assign(new Error("x"), { status: 499 }), "/x");
      expect(problem).toMatchObject({ status: 499, title: "Error" });
    });

    it("names the status of a client error that has no fixed detail", () => {
      const problem = toProblemDetails(Object.assign(new Error("x"), { status: 431 }), "/x");
      expect(problem).toMatchObject({ status: 431, detail: "Request Header Fields Too Large" });
    });

    it("does not trust a status outside the error range", () => {
      expect(toProblemDetails(Object.assign(new Error("x"), { status: 200 }), "/x").status).toBe(
        500,
      );
    });
  });

  describe("unknown errors", () => {
    it("answers 500 with a generic message and nothing from the error", () => {
      const error = new Error("connection to db.internal:5432 refused");
      const problem = toProblemDetails(error, "/api/v1/orders");
      expect(problem).toEqual({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "An unexpected error occurred.",
        instance: "/api/v1/orders",
      });
    });

    it("answers 500 for a thrown value that is not an Error", () => {
      expect(toProblemDetails("boom", "/x").status).toBe(500);
    });
  });
});

describe("toProblemDetails: database failures", () => {
  const instance = "/api/v1/things";

  it.each(DATABASE_ERROR_KINDS)("answers the exact fixed body for %s", (kind) => {
    expect(toProblemDetails(buildObservedDatabaseError(kind), instance)).toEqual(
      fixedDatabaseProblem(kind, instance),
    );
  });

  it("does not let an HTTP exception that wraps a database error become a database answer", () => {
    const wrapped = new InternalServerErrorException("x", {
      cause: buildObservedDatabaseError("unique_violation"),
    });

    expect(toProblemDetails(wrapped, instance)).toEqual(fixedDatabaseProblem("unknown", instance));
  });

  it("keeps the readiness answer for the typed readiness error", () => {
    expect(toProblemDetails(new ServiceNotReadyError(), instance)).toEqual({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      detail: "The service is not ready.",
      instance,
    });
  });

  it("keeps a client error of the body parser, even when it also has a Prisma-looking code", () => {
    const problem = toProblemDetails({ status: 413, code: "P2002" }, instance);

    expect(problem).toEqual({
      type: "about:blank",
      title: "Payload Too Large",
      status: 413,
      detail: "The request body is too large.",
      instance,
    });
  });
});
