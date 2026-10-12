import { createHash } from "node:crypto";
import type { PrismaClient, StaffRole } from "@entana/database";
import { hashPassword } from "@entana/password-hash";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { startOrdersApp } from "../../e2e/support/start-orders-app.js";
import { captureLogs } from "../../e2e/support/log-capture.js";
import type { LogCapture } from "../../e2e/support/log-capture.js";
import { ADMIN_TEST_ORIGIN, buildTestConfig } from "../../e2e/support/test-config.js";
import { assertThrowawayDatabase } from "./assert-throwaway-database.js";
import { ManualClock, openOrdersClient } from "./orders-fixtures.js";

export const LOGIN_PATH = "/api/v1/admin/auth/login";
const LOGOUT_PATH = "/api/v1/admin/auth/logout";
export const ME_PATH = "/api/v1/admin/auth/me";
export const COOKIE_NAME = "__Host-admin_session";
/** Obviously fake. */
export const FAKE_PASSWORD = "a fake password for tests";

interface NewAccount {
  readonly email?: string;
  readonly password?: string;
  readonly role?: StaffRole;
  readonly isActive?: boolean;
  readonly name?: string;
}

export interface AdminHarness {
  readonly client: PrismaClient;
  readonly clock: ManualClock;
  readonly logs: LogCapture;
  /** A fresh client address, so that the limit of one test never reaches another. */
  readonly from: () => string;
  /** An e-mail no other test uses: the limit per account is kept in the memory of the app. */
  readonly newEmail: () => string;
  readonly createAccount: (account?: NewAccount) => Promise<{ email: string; id: string }>;
  readonly login: (body: unknown, address?: string) => request.Test;
  readonly me: (cookie?: string) => request.Test;
  readonly logout: (cookie?: string) => request.Test;
  /** `name=value` of the session cookie of a login answer, ready to send back. */
  readonly cookieOf: (response: request.Response) => string;
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** The real application on the throwaway database, started once per describe block. */
export function useAdminHarness(): AdminHarness {
  const client = openOrdersClient();
  const logs = captureLogs();
  const clock = new ManualClock();
  let app: NestExpressApplication | undefined;
  let addressCounter = 0;
  let emailCounter = 0;

  const getApp = (): NestExpressApplication => {
    if (app === undefined) {
      throw new Error("The application is not started.");
    }
    return app;
  };
  const from = (): string => {
    addressCounter += 1;
    return `198.51.100.${String(addressCounter % 250)}`;
  };
  const newEmail = (): string => {
    emailCounter += 1;
    return `admin-${String(emailCounter)}@example.mg`;
  };
  const clean = async (): Promise<void> => {
    await assertThrowawayDatabase(client);
    await client.adminSession.deleteMany();
    await client.staffUser.deleteMany({ where: { email: { not: null } } });
  };

  beforeAll(async () => {
    app = await startOrdersApp(
      buildTestConfig({
        DATABASE_URL: inject("throwawayConnectionString"),
        TRUST_PROXY: "1",
        LOG_LEVEL: "info",
        ADMIN_COOKIE_SECURE: "true",
      }),
      { clock, logs: logs.stream },
    );
  });
  beforeEach(async () => {
    await clean();
    logs.reset();
  });
  afterAll(async () => {
    await getApp().close();
    await clean();
    await client.$disconnect();
  });

  const send = (method: "get" | "post", path: string, cookie: string | undefined): request.Test => {
    const test = request(getApp().getHttpServer())[method](path).set("X-Forwarded-For", from());
    if (method === "post") {
      test.set("Origin", ADMIN_TEST_ORIGIN);
    }
    return cookie === undefined ? test : test.set("Cookie", cookie);
  };

  return {
    client,
    clock,
    logs,
    from,
    newEmail,
    createAccount: async (account = {}) => {
      const email = account.email ?? newEmail();
      const created = await client.staffUser.create({
        data: {
          email,
          username: email,
          name: account.name ?? "Test Admin",
          role: account.role ?? "ADMIN",
          active: account.isActive ?? true,
          passwordHash: await hashPassword(account.password ?? FAKE_PASSWORD),
        },
        select: { id: true },
      });
      return { email, id: created.id };
    },
    login: (body, address = from()) =>
      request(getApp().getHttpServer())
        .post(LOGIN_PATH)
        .set("X-Forwarded-For", address)
        .set("Origin", ADMIN_TEST_ORIGIN)
        .send(body as object),
    me: (cookie) => send("get", ME_PATH, cookie),
    logout: (cookie) => send("post", LOGOUT_PATH, cookie),
    cookieOf: (response) => {
      const header: unknown = response.headers["set-cookie"];
      const first: unknown = Array.isArray(header) ? header[0] : undefined;
      const pair = typeof first === "string" ? first.split(";")[0] : undefined;
      if (pair === undefined) {
        throw new Error("The answer sets no cookie.");
      }
      return pair;
    },
  };
}
