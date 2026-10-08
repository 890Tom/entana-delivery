import http from "node:http";
import type { AddressInfo } from "node:net";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ORDERS_PATH, newKey } from "../../support/order-http.js";

// Declares a 1 MB body, sends the start of it and reads the answer as soon as it comes: the server
// may close the connection once it has answered, so the rest of the body is never sent.
export function postOversizedBody(
  app: NestExpressApplication,
  address: string,
): Promise<{ status: number; body: unknown }> {
  const { port } = app.getHttpServer().address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const outgoing = http.request(
      {
        port,
        host: "127.0.0.1",
        method: "POST",
        path: ORDERS_PATH,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": 1_000_000,
          "Idempotency-Key": newKey(),
          "X-Forwarded-For": address,
        },
      },
      (incoming) => {
        let text = "";
        let isSettled = false;
        // The server may close the connection right after a 413: "close" then ends the answer.
        const settle = (): void => {
          if (isSettled) {
            return;
          }
          isSettled = true;
          outgoing.destroy();
          try {
            resolve({ status: incoming.statusCode ?? 0, body: JSON.parse(text) as unknown });
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error("The answer is not JSON."));
          }
        };
        incoming.on("data", (chunk: Buffer) => {
          text += chunk.toString();
        });
        incoming.on("end", settle);
        incoming.on("close", settle);
        incoming.on("error", settle);
      },
    );
    // Once the answer is read, a reset of the connection is expected and harmless.
    outgoing.on("error", () => undefined);
    outgoing.write(`{"customerNote":"${"x".repeat(60_000)}`);
    setTimeout(() => {
      reject(new Error("No answer."));
    }, 3000).unref();
  });
}
