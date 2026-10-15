import { parsePhoneNumber } from "@entana/contracts";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXAMPLE_PHONE } from "../../src/docs/example-phone.js";
import { startOrdersApp } from "./support/start-orders-app.js";
import { buildTestConfig } from "./support/test-config.js";

interface Operation {
  readonly operationId: string;
  readonly parameters: readonly { name: string; in: string; required?: boolean }[];
  readonly requestBody: { content: Record<string, { schema: unknown; examples?: unknown }> };
  readonly responses: Record<string, unknown>;
}

describe("the OpenAPI document of POST /api/v1/orders", () => {
  let app: NestExpressApplication;
  let operation: Operation;
  let documentText: string;

  beforeAll(async () => {
    app = await startOrdersApp(buildTestConfig());
    const response = await request(app.getHttpServer()).get("/api/docs-json");
    documentText = response.text;
    const document = JSON.parse(documentText) as { paths: Record<string, { post: Operation }> };
    operation = document.paths["/api/v1/orders"]?.post ?? ({} as Operation);
  });
  afterAll(async () => {
    await app.close();
  });

  it("documents the route", () => {
    expect(operation.operationId).toBe("createOrder");
  });

  it("requires the Idempotency-Key header", () => {
    expect(operation.parameters).toContainEqual(
      expect.objectContaining({ name: "Idempotency-Key", in: "header", required: true }),
    );
  });

  it("documents the body from the shared schema", () => {
    const schema = operation.requestBody.content["application/json"]?.schema;

    expect(JSON.stringify(schema)).toContain("trackingToken");
  });

  it.each(["201", "400", "403", "409", "413", "415", "422", "429", "500", "503"])(
    "documents the %s response",
    (status) => {
      expect(Object.keys(operation.responses)).toContain(status);
    },
  );

  it("uses obviously fake examples, and a phone number that the numbering plan accepts", () => {
    expect(documentText).toContain(EXAMPLE_PHONE);
    expect(parsePhoneNumber(EXAMPLE_PHONE, "261").ok).toBe(true);
    // No realistic Malagasy mobile number or coordinates of the capital, the one fake example
    // of the phone number set aside.
    expect(documentText.replaceAll(EXAMPLE_PHONE, "")).not.toMatch(
      /\+?261\s?3\d|03[2-9] ?\d\d ?\d{3} ?\d\d|-18\.\d|47\.5/,
    );
  });
});
