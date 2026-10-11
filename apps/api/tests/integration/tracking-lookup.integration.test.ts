import { trackingResponseSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { hashTrackingToken } from "../../src/orders/rules/hash-tracking-token.js";
import { FAKE_PHONE_INPUT, FAKE_LANDMARK } from "../support/order-request.js";
import {
  FIXED_LOOKUP_404,
  LOOKUP_PATH,
  TRACKING_RESPONSE_HEADERS,
} from "../support/tracking-http.js";
import { useTrackingHarness } from "./support/tracking-harness.js";

// Both are valid for the numbering plan and are not the phone number of the order.
const OTHER_PHONE_INPUT = "034 11 111 11";
const TEN_PHONE_INPUTS = Array.from({ length: 10 }, (_, index) => `034 00 000 0${String(index)}`);

const otherCodeThan = (code: string): string => (code === "ZZZZZZ" ? "YYYYYY" : "ZZZZZZ");

describe("looking an order up by phone number and order code on a real PostgreSQL", () => {
  const { clock, from, lookup, placeOrder, request } = useTrackingHarness();

  it("answers the tracking view, not cancellable, with no token and no hash", async () => {
    const { token, orderCode } = await placeOrder();
    const typedByHand = `${orderCode.slice(0, 3).toLowerCase()}-${orderCode.slice(3)}`;

    const response = await lookup({ phone: FAKE_PHONE_INPUT, orderCode: typedByHand });

    expect(response.status).toBe(200);
    expect(response.headers).toMatchObject(TRACKING_RESPONSE_HEADERS);
    expect(trackingResponseSchema.parse(response.body)).toEqual({
      orderCode,
      status: "NEW",
      deliveryDate: null,
      landmarkText: FAKE_LANDMARK,
      totalAr: 10000,
      deliveryFeeAr: 0,
      itemCount: 2,
      createdAt: clock.now().toISOString(),
      rejectionReason: null,
      canCancel: false,
    });
    expect(response.text).not.toContain(token);
    expect(response.text).not.toContain(hashTrackingToken(token));
  });

  it("answers the same 404, with the same body, whatever the cause", async () => {
    const { orderCode } = await placeOrder();

    const unknownCode = await lookup({
      phone: FAKE_PHONE_INPUT,
      orderCode: otherCodeThan(orderCode),
    });
    const wrongPhone = await lookup({ phone: OTHER_PHONE_INPUT, orderCode });
    const malformedCode = await lookup({ phone: FAKE_PHONE_INPUT, orderCode: "AB0" });

    for (const response of [unknownCode, wrongPhone, malformedCode]) {
      expect(response.status).toBe(404);
      expect(response.headers).toMatchObject(TRACKING_RESPONSE_HEADERS);
      expect(response.body).toEqual(FIXED_LOOKUP_404);
    }
    expect(wrongPhone.text).toBe(unknownCode.text);
  });

  it("refuses a phone number that is not valid with a 400 that does not repeat it", async () => {
    const response = await lookup({ phone: "034 00", orderCode: "ABC234" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ errors: [{ pointer: "/phone" }] });
    expect(response.text).not.toContain("034 00");
  });

  it("refuses a body that is not JSON with a 415", async () => {
    const response = await request()
      .post(LOOKUP_PATH)
      .set("X-Forwarded-For", from())
      .type("text/plain")
      .send(JSON.stringify({ phone: FAKE_PHONE_INPUT, orderCode: "ABC234" }));

    expect(response.status).toBe(415);
  });

  it("refuses the 11th request of an address with a 429 and Retry-After", async () => {
    const address = from();
    for (const phone of TEN_PHONE_INPUTS) {
      const accepted = await lookup({ phone, orderCode: "ABC234" }, address);
      expect(accepted.status).toBe(404);
    }

    const limited = await lookup({ phone: TEN_PHONE_INPUTS[0], orderCode: "ABC234" }, address);

    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe("600");
  });
});
