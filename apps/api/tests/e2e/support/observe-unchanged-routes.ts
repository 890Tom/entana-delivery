import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { startAppWithClient, startAppWithProbe } from "./create-test-app.js";
import { buildTestConfig } from "./test-config.js";

interface ObservedResponse {
  readonly status: number;
  readonly contentType: string | undefined;
  readonly cacheControl: string | undefined;
  readonly body: unknown;
}

export type ObservedRoutes = Readonly<Record<string, ObservedResponse>>;

// The uptime and the version change from one run and one release to the next.
function withoutVolatileFields(body: unknown): unknown {
  if (typeof body !== "object" || body === null) {
    return body;
  }
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => key !== "uptimeSeconds" && key !== "version"),
  );
}

function observe(response: request.Response): ObservedResponse {
  return {
    status: response.status,
    contentType: response.headers["content-type"]?.toString(),
    cacheControl: response.headers["cache-control"]?.toString(),
    body: withoutVolatileFields(response.body),
  };
}

/**
 * Answers of the routes that validation errors must not change, on the real application. The
 * database client is a stand-in that fails every query, so that the answers are deterministic.
 */
export async function observeUnchangedRoutes(): Promise<ObservedRoutes> {
  const config = buildTestConfig({ BODY_LIMIT_KB: "1" });
  const failing = await startAppWithClient(config, {});
  const probed = await startAppWithProbe(config);
  try {
    const server = (app: NestExpressApplication): ReturnType<typeof request> =>
      request(app.getHttpServer());
    return {
      health: observe(await server(failing).get("/api/v1/health")),
      readiness: observe(await server(failing).get("/api/v1/health/ready")),
      products: observe(await server(failing).get("/api/v1/products")),
      notFound: observe(await server(failing).get("/api/v1/unknown?x=1")),
      malformedJson: observe(
        await server(probed)
          .post("/api/v1/probe/validation")
          .set("Content-Type", "application/json")
          .send('{"name": '),
      ),
    };
  } finally {
    await failing.close();
    await probed.close();
  }
}
