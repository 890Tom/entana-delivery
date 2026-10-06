import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { problemDetailsSchema } from "@entana/contracts";
import { DATABASE_ERROR_KINDS } from "@entana/database";
import { describe, expect, it } from "vitest";
import { fixedDatabaseProblem } from "../../tests/support/fixed-database-problems.js";
import { buildObservedDatabaseError } from "../../tests/support/observed-database-errors.js";
import { toProblemDetails } from "./to-problem-details.js";
import { RequestValidationError } from "./request-validation-error.js";
import { ServiceNotReadyError } from "./service-not-ready-error.js";

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

  it("keeps the message the developer wrote for an HTTP exception", () => {
    const problem = toProblemDetails(new ForbiddenException("Not your order."), "/x");
    expect(problem).toMatchObject({ status: 403, detail: "Not your order." });
  });

  it("keeps the message of an HTTP exception that has a status without a standard name", () => {
    const problem = toProblemDetails(new HttpException("Custom.", 499), "/x");
    expect(problem).toMatchObject({ status: 499, title: "Error", detail: "Custom." });
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
    it("lists the invalid fields as JSON pointers", () => {
      const error = new RequestValidationError([
        { message: "Too small", path: ["items", 0, "quantity"] },
        { message: "Required", path: [{ key: "phone" }] },
      ]);
      expect(toProblemDetails(error, "/api/v1/orders")).toMatchObject({
        type: "urn:entana:problem:validation-error",
        title: "Bad Request",
        status: 400,
        detail: "The request is invalid.",
        errors: [
          { pointer: "/items/0/quantity", detail: "Too small" },
          { pointer: "/phone", detail: "Required" },
        ],
      });
    });

    it("points at the whole body when the issue has no path", () => {
      const error = new RequestValidationError([{ message: "Expected an object" }]);
      expect(toProblemDetails(error, "/x").errors).toEqual([
        { pointer: "", detail: "Expected an object" },
      ]);
    });

    it("escapes the characters that are special in a JSON pointer", () => {
      const error = new RequestValidationError([{ message: "m", path: ["a/b", "c~d"] }]);
      expect(toProblemDetails(error, "/x").errors).toEqual([
        { pointer: "/a~1b/c~0d", detail: "m" },
      ]);
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
