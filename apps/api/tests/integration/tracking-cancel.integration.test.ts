import { describe, expect, it } from "vitest";
import { generateTrackingToken } from "../support/order-request.js";
import { CANCEL_PATH, FIXED_404, TRACKING_RESPONSE_HEADERS } from "../support/tracking-http.js";
import { startConsoleCapture } from "./support/console-capture.js";
import { useTrackingHarness } from "./support/tracking-harness.js";
import type { Response } from "supertest";

const CUSTOMER_REASON = "Annulée par le client.";

describe("cancelling an order by its tracking token on a real PostgreSQL", () => {
  const { client, logs, from, read, cancel, placeOrder, moveTo, countCancellationEvents } =
    useTrackingHarness();

  describe("cancellation", () => {
    it.each(["NEW", "CONFIRMED"] as const)(
      "moves a %s order to CANCELLED with one event of the customer",
      async (status) => {
        const { token, orderCode } = await placeOrder();
        if (status === "CONFIRMED") {
          await moveTo(orderCode, "CONFIRMED");
        }

        const response = await cancel(token);

        expect(response.status).toBe(200);
        expect(response.headers).toMatchObject(TRACKING_RESPONSE_HEADERS);
        expect(response.body).toMatchObject({
          status: "CANCELLED",
          canCancel: false,
          rejectionReason: null,
        });
        const events = await client.orderEvent.findMany({
          where: { order: { publicCode: orderCode }, toStatus: "CANCELLED" },
          select: { type: true, fromStatus: true, actorType: true, payload: true },
        });
        expect(events).toEqual([
          { type: "STATUS_CHANGED", fromStatus: status, actorType: "CUSTOMER", payload: {} },
        ]);
        const stored = await client.customerOrder.findUniqueOrThrow({
          where: { publicCode: orderCode },
          select: { statusReason: true },
        });
        expect(stored.statusReason).toBe(CUSTOMER_REASON);
      },
    );

    it("answers 200 to a second cancellation, without a second event", async () => {
      const { token, orderCode } = await placeOrder();
      await cancel(token);

      const second = await cancel(token);

      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({ status: "CANCELLED" });
      expect(await countCancellationEvents(orderCode)).toBe(1);
    });

    it.each(["OUT_FOR_DELIVERY", "DELIVERED", "REJECTED", "FAILED"] as const)(
      "answers 409 for a %s order and changes nothing",
      async (status) => {
        const { token, orderCode } = await placeOrder();
        await moveTo(orderCode, status);
        const eventsBefore = await client.orderEvent.count();

        const response = await cancel(token);

        expect(response.status).toBe(409);
        expect(response.headers).toMatchObject(TRACKING_RESPONSE_HEADERS);
        const stored = await client.customerOrder.findUniqueOrThrow({
          where: { publicCode: orderCode },
          select: { status: true },
        });
        expect(stored.status).toBe(status);
        expect(await client.orderEvent.count()).toBe(eventsBefore);
      },
    );

    it("writes one event when ten cancellations arrive together", async () => {
      const { token, orderCode } = await placeOrder();

      const answers = await Promise.all(Array.from({ length: 10 }, () => cancel(token)));

      expect(answers.map((answer) => answer.status)).toEqual(Array<number>(10).fill(200));
      expect(await countCancellationEvents(orderCode)).toBe(1);
    });

    it("answers the unknown-token 404 for an unknown token and changes nothing", async () => {
      await placeOrder();

      const response = await cancel(generateTrackingToken());

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ ...FIXED_404, instance: CANCEL_PATH });
    });
  });

  describe("a distinctive token reaches no body, header or log", () => {
    it("holds for a 200, a 404, a 409 and a 429", async () => {
      const { token, orderCode } = await placeOrder();
      const unknownToken = `LEAK${generateTrackingToken().slice(4)}`;
      const consoleCapture = startConsoleCapture();
      const outputs: string[] = [];
      const collect = (response: Response): void => {
        outputs.push(response.text, JSON.stringify(response.headers));
      };

      collect(await read(token));
      collect(await read(unknownToken));
      await moveTo(orderCode, "DELIVERED");
      collect(await cancel(token));
      const limited = from();
      for (let count = 0; count < 120; count += 1) {
        await read(unknownToken, limited);
      }
      const answer = await read(token, limited);
      expect(answer.status).toBe(429);
      collect(answer);
      const consoleLines = consoleCapture.stop();

      const everything = [...outputs, logs.text(), ...consoleLines].join("\n");
      expect(everything).not.toContain(token);
      expect(everything).not.toContain(unknownToken);
      // The code belongs in the body of the 200, but never in a log line or on the console.
      expect([logs.text(), ...consoleLines].join("\n")).not.toContain(orderCode);
    });
  });
});
