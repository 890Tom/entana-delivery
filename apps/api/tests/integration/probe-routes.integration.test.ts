import request from "supertest";
import { describe, expect, it } from "vitest";
import { startRealApp } from "../e2e/support/create-test-app.js";
import { buildTestConfig } from "../e2e/support/test-config.js";
import { PROBE_PATHS } from "./support/failure-cases.module.js";

describe("the test-only routes", () => {
  it.each(Object.entries(PROBE_PATHS))(
    "%s does not exist on the real application module",
    async (_name, path) => {
      const realApp = await startRealApp(buildTestConfig());
      try {
        const response = await request(realApp.getHttpServer()).get(path);

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ status: 404, title: "Not Found", instance: path });
      } finally {
        await realApp.close();
      }
    },
  );
});
