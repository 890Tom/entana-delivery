import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrismaClient } from "@entana/database";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import { startOrdersApp } from "../../e2e/support/start-orders-app.js";
import { ADMIN_TEST_ORIGIN, buildTestConfig } from "../../e2e/support/test-config.js";
import { newKey } from "../../support/order-http.js";
import {
  FAKE_CONTACT_NAME,
  FAKE_PHONE_INPUT,
  buildOrderRequest,
  generateTrackingToken,
} from "../../support/order-request.js";
import { TRACKING_HEADER, TRACKING_PATH } from "../../support/tracking-http.js";
import { FAKE_PASSWORD, LOGIN_PATH } from "./admin-harness.js";
import { insertProduct } from "./insert-product.js";
import {
  ManualClock,
  createOrdersService,
  openOrdersClient,
  resetOrderData,
} from "./orders-fixtures.js";
import { hashPassword } from "@entana/password-hash";

export const ORDERS_PATH = "/api/v1/admin/orders";

interface PlacedOrder {
  readonly id: string;
  readonly code: string;
  readonly token: string;
}

export interface AdminOrdersHarness {
  readonly client: PrismaClient;
  readonly clock: ManualClock;
  /** The id of the signed-in admin, whose session cookie every `get` and `post` sends. */
  readonly adminId: string;
  /** The media folder of this run: a throwaway directory with a `products` folder. */
  readonly mediaRoot: string;
  /** PUT of a multipart body with one `photo` file (the name `photo` is the field name). */
  readonly putPhoto: (
    path: string,
    file: Buffer,
    options?: { readonly cookie?: string | null; readonly field?: string },
  ) => request.Test;
  readonly get: (path: string, cookie?: string | null) => request.Test;
  readonly post: (path: string, body: unknown, cookie?: string | null) => request.Test;
  readonly put: (path: string, body: unknown, cookie?: string | null) => request.Test;
  readonly patch: (path: string, body: unknown, cookie?: string | null) => request.Test;
  readonly delete: (path: string, cookie?: string | null) => request.Test;
  /** A phone number per call keeps a customer under the limit of recent orders. */
  readonly placeOrder: (
    quantity?: number,
    phone?: string,
    contactName?: string,
  ) => Promise<PlacedOrder>;
  readonly setStatus: (orderId: string, status: "CONFIRMED" | "OUT_FOR_DELIVERY") => Promise<void>;
  readonly tracking: (token: string) => request.Test;
}

/** The real application on the throwaway database, with one signed-in admin. */
export function useAdminOrdersHarness(): AdminOrdersHarness {
  const client = openOrdersClient();
  const clock = new ManualClock();
  let app: NestExpressApplication | undefined;
  let cookie = "";
  let adminId = "";
  let addressCounter = 0;
  const mediaRoot = mkdtempSync(join(tmpdir(), "entana-admin-media-"));
  mkdirSync(join(mediaRoot, "products"));

  const getApp = (): NestExpressApplication => {
    if (app === undefined) {
      throw new Error("The application is not started.");
    }
    return app;
  };
  const nextAddress = (): string => {
    addressCounter += 1;
    return `203.0.113.${String(addressCounter % 250)}`;
  };
  const clean = async (): Promise<void> => {
    await resetOrderData(client);
    await client.auditLog.deleteMany();
    await client.reseller.deleteMany();
    await client.adminSession.deleteMany();
    await client.staffUser.deleteMany({ where: { email: { not: null } } });
    for (const file of readdirSync(join(mediaRoot, "products"))) {
      rmSync(join(mediaRoot, "products", file));
    }
  };

  beforeAll(async () => {
    app = await startOrdersApp(
      buildTestConfig({
        DATABASE_URL: inject("throwawayConnectionString"),
        TRUST_PROXY: "1",
        LOG_LEVEL: "error",
        ADMIN_COOKIE_SECURE: "true",
        MEDIA_ROOT: mediaRoot,
      }),
      { clock },
    );
  });
  beforeEach(async () => {
    await clean();
    const created = await client.staffUser.create({
      data: {
        email: "orders-admin@example.mg",
        username: "orders-admin@example.mg",
        name: "Orders Admin",
        role: "ADMIN",
        active: true,
        passwordHash: await hashPassword(FAKE_PASSWORD),
      },
      select: { id: true },
    });
    adminId = created.id;
    const login = await request(getApp().getHttpServer())
      .post(LOGIN_PATH)
      .set("X-Forwarded-For", nextAddress())
      .set("Origin", ADMIN_TEST_ORIGIN)
      .send({ email: "orders-admin@example.mg", password: FAKE_PASSWORD });
    const header: unknown = login.headers["set-cookie"];
    const first: unknown = Array.isArray(header) ? header[0] : undefined;
    cookie = typeof first === "string" ? (first.split(";")[0] ?? "") : "";
  });
  afterAll(async () => {
    await getApp().close();
    await clean();
    await client.$disconnect();
    rmSync(mediaRoot, { recursive: true, force: true });
  });

  const withCookie = (test: request.Test, sent: string | null | undefined): request.Test => {
    const value = sent === undefined ? cookie : sent;
    return value === null ? test : test.set("Cookie", value);
  };

  const sendWithBody = (
    method: "post" | "put" | "patch",
    path: string,
    body: unknown,
    sent: string | null | undefined,
  ): request.Test =>
    withCookie(
      request(getApp().getHttpServer())
        [method](path)
        .set("X-Forwarded-For", nextAddress())
        .set("Origin", ADMIN_TEST_ORIGIN)
        .send(body as object),
      sent,
    );

  return {
    client,
    clock,
    get adminId() {
      return adminId;
    },
    mediaRoot,
    putPhoto: (path, file, options = {}) =>
      withCookie(
        request(getApp().getHttpServer())
          .put(path)
          .set("X-Forwarded-For", nextAddress())
          .set("Origin", ADMIN_TEST_ORIGIN)
          .attach(options.field ?? "photo", file, { filename: "photo.jpg" }),
        options.cookie,
      ),
    get: (path, sent) =>
      withCookie(
        request(getApp().getHttpServer()).get(path).set("X-Forwarded-For", nextAddress()),
        sent,
      ),
    delete: (path, sent) =>
      withCookie(
        request(getApp().getHttpServer())
          .delete(path)
          .set("X-Forwarded-For", nextAddress())
          .set("Origin", ADMIN_TEST_ORIGIN),
        sent,
      ),
    post: (path, body, sent) => sendWithBody("post", path, body, sent),
    put: (path, body, sent) => sendWithBody("put", path, body, sent),
    patch: (path, body, sent) => sendWithBody("patch", path, body, sent),
    placeOrder: async (quantity = 2, phone = FAKE_PHONE_INPUT, contactName = FAKE_CONTACT_NAME) => {
      const productId = await insertProduct(client, { priceAr: 5000 });
      const token = generateTrackingToken();
      const { response } = await createOrdersService(client, { clock }).createOrder(
        buildOrderRequest([{ productId, quantity }], {
          trackingToken: token,
          phone,
          contactName,
        }),
        newKey(),
      );
      const stored = await client.customerOrder.findUniqueOrThrow({
        where: { publicCode: response.orderCode },
        select: { id: true },
      });
      return { id: stored.id, code: response.orderCode, token };
    },
    setStatus: async (orderId, status) => {
      await client.customerOrder.update({
        where: { id: orderId },
        data: { status, deliveryDate: new Date("2026-10-09") },
      });
    },
    tracking: (token) =>
      request(getApp().getHttpServer())
        .get(TRACKING_PATH)
        .set("X-Forwarded-For", nextAddress())
        .set(TRACKING_HEADER, token),
  };
}
