import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { AdminOriginRefusedError } from "../errors/admin-auth-errors.js";
import { createAdminOriginMiddleware } from "./admin-origin.middleware.js";
import { sessionCookieSettings } from "./session-cookie.js";

const ADMIN_ORIGIN = "https://admin.example.mg";
const middleware = createAdminOriginMiddleware({
  allowedOrigins: [ADMIN_ORIGIN],
  cookie: sessionCookieSettings(false),
});

function run(method: string, headers: Record<string, string>): unknown {
  let outcome: unknown = "not called";
  const next: NextFunction = (error?: unknown) => {
    outcome = error;
  };
  middleware({ method, headers } as unknown as Request, {} as Response, next);
  return outcome;
}

describe("admin origin check", () => {
  it("lets a change come from an allowed origin", () => {
    expect(run("POST", { origin: ADMIN_ORIGIN })).toBeUndefined();
  });

  it("refuses a change that comes from another origin, even with no cookie", () => {
    expect(run("POST", { origin: "https://evil.example" })).toBeInstanceOf(AdminOriginRefusedError);
    expect(run("DELETE", { origin: "null" })).toBeInstanceOf(AdminOriginRefusedError);
  });

  it("refuses a change with no origin when the session cookie is sent", () => {
    expect(run("POST", { cookie: "admin_session=x" })).toBeInstanceOf(AdminOriginRefusedError);
  });

  it("lets a change with neither origin nor session cookie through (a command-line client)", () => {
    expect(run("POST", {})).toBeUndefined();
  });

  it.each(["GET", "HEAD", "OPTIONS"])("does not check %s", (method) => {
    expect(run(method, { origin: "https://evil.example" })).toBeUndefined();
  });
});
