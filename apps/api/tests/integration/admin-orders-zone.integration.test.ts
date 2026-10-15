import { adminOrderDetailSchema, adminOrderListResponseSchema } from "@entana/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { ORDERS_PATH, useAdminOrdersHarness } from "./support/admin-orders-harness.js";
import { resetDeliveryRules } from "./support/orders-fixtures.js";

const UNKNOWN_AXIS_ID = "0199f5b0-7c1e-7a3b-9d4f-000000000000";

describe("the delivery zone of the orders of the administration on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  let axisCount = 0;

  // Without axes, every order placed here is out of axis; the zone of an order is then set by hand.
  beforeEach(async () => {
    await resetDeliveryRules(h.client);
  });

  /** An axis with one place, far from the point of the fake orders. */
  const insertAxis = async (axisName: string, placeName: string) => {
    axisCount += 1;
    const place = await h.client.place.create({
      data: { name: placeName, lat: 0, lng: 0, radiusM: 500, active: true },
      select: { id: true },
    });
    const axis = await h.client.deliveryAxis.create({
      data: {
        name: axisName,
        rank: axisCount,
        color: "#2f6b5a",
        active: true,
        places: { create: [{ placeId: place.id, position: 1 }] },
      },
      select: { id: true },
    });
    return { axisId: axis.id, placeId: place.id };
  };

  const placeOrderIn = async (zone: { axisId: string; placeId: string }): Promise<string> => {
    const order = await h.placeOrder();
    await h.client.customerOrder.update({ where: { id: order.id }, data: zone });
    return order.id;
  };

  const listIds = async (query: string): Promise<string[]> => {
    const answer = await h.get(`${ORDERS_PATH}?${query}`);
    expect(answer.status).toBe(200);
    return adminOrderListResponseSchema.parse(answer.body).items.map((item) => item.id);
  };

  describe("deliveryZone", () => {
    it("names the current place and axis of an order in an axis, in the list and the detail", async () => {
      const zone = await insertAxis("Fake Axis", "Fake Market");
      const id = await placeOrderIn(zone);
      await h.client.place.update({
        where: { id: zone.placeId },
        data: { name: "Renamed Market" },
      });

      const list = adminOrderListResponseSchema.parse((await h.get(ORDERS_PATH)).body);
      const detail = adminOrderDetailSchema.parse((await h.get(`${ORDERS_PATH}/${id}`)).body);

      const expected = { placeName: "Renamed Market", axisName: "Fake Axis" };
      expect(list.items[0]?.deliveryZone).toEqual(expected);
      expect(detail.deliveryZone).toEqual(expected);
    });

    it("is null for an order outside every axis, in the list and the detail", async () => {
      const order = await h.placeOrder();

      const list = adminOrderListResponseSchema.parse((await h.get(ORDERS_PATH)).body);
      const detail = adminOrderDetailSchema.parse((await h.get(`${ORDERS_PATH}/${order.id}`)).body);

      expect([list.items[0]?.deliveryZone, detail.deliveryZone]).toEqual([null, null]);
    });
  });

  describe("the zone filter", () => {
    it("keeps only the orders of the axis asked for", async () => {
      const north = await insertAxis("North", "North Market");
      const south = await insertAxis("South", "South Market");
      const inNorth = await placeOrderIn(north);
      await placeOrderIn(south);
      await h.placeOrder();

      expect(await listIds(`zone=${north.axisId}`)).toEqual([inNorth]);
    });

    it("keeps only the orders outside every axis for none", async () => {
      await placeOrderIn(await insertAxis("North", "North Market"));
      const outside = await h.placeOrder();

      expect(await listIds("zone=none")).toEqual([outside.id]);
    });

    it("answers an empty list for an axis that does not exist", async () => {
      await placeOrderIn(await insertAxis("North", "North Market"));

      expect(await listIds(`zone=${UNKNOWN_AXIS_ID}`)).toEqual([]);
    });

    it("combines with the status filter", async () => {
      const north = await insertAxis("North", "North Market");
      const confirmed = await placeOrderIn(north);
      await placeOrderIn(north);
      await h.setStatus(confirmed, "CONFIRMED");
      await h.setStatus((await h.placeOrder()).id, "CONFIRMED");

      expect(await listIds(`zone=${north.axisId}&status=CONFIRMED`)).toEqual([confirmed]);
    });

    it("answers 400 in problem details for a zone that is neither an axis id nor none", async () => {
      const answer = await h.get(`${ORDERS_PATH}?zone=outside`);

      expect(answer.status).toBe(400);
      expect(answer.headers["content-type"]).toContain("application/problem+json");
      expect(answer.text).not.toContain("outside");
    });
  });
});
