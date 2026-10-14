import { deliveryQuoteResponseSchema } from "@entana/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";

const QUOTE_PATH = "/api/v1/delivery/quote";
const STORED_SETTINGS = {
  outOfAxisFeeAr: 3500,
  freeDeliveryMinPieces: 12,
  outOfAxisMessage: "Fake out of axis message.",
};
const CENTRE = { latitude: -18.9, longitude: 47.5 };
const FAR = { latitude: 0, longitude: 0 };

describe("the public delivery quote on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();

  beforeEach(async () => {
    await h.client.axisPlace.deleteMany();
    await h.client.deliveryAxis.deleteMany();
    await h.client.place.deleteMany();
    await h.client.shopSetting.update({ where: { id: 1 }, data: STORED_SETTINGS });
  });

  const insertPlace = async (name: string, isActive = true): Promise<string> =>
    (
      await h.client.place.create({
        data: { name, lat: CENTRE.latitude, lng: CENTRE.longitude, radiusM: 500, active: isActive },
        select: { id: true },
      })
    ).id;
  const insertAxis = async (rank: number, placeIds: readonly string[], isActive = true) =>
    h.client.deliveryAxis.create({
      data: {
        name: `Axis ${String(rank)}`,
        rank,
        color: "#2f6b5a",
        active: isActive,
        places: { create: placeIds.map((placeId, index) => ({ placeId, position: index + 1 })) },
      },
      select: { id: true },
    });
  const quote = (point: { latitude: number; longitude: number }, pieces: number) =>
    h.post(QUOTE_PATH, { ...point, pieces }, null);

  it("is free inside an axis and names the place, without a session", async () => {
    await insertAxis(1, [await insertPlace("Fake Market")]);

    const answer = await quote(CENTRE, 1);

    expect(answer.status).toBe(200);
    expect(answer.headers["cache-control"]).toBe("no-store");
    expect(deliveryQuoteResponseSchema.parse(answer.body)).toEqual({
      feeAr: 0,
      reason: "axis",
      placeName: "Fake Market",
      outOfAxisMessage: null,
      freeDeliveryMinPieces: 12,
    });
  });

  it("charges the out-of-axis fee of the settings below the piece threshold", async () => {
    await insertAxis(1, [await insertPlace("Fake Market")]);

    const answer = await quote(FAR, 11);

    expect(deliveryQuoteResponseSchema.parse(answer.body)).toEqual({
      feeAr: 3500,
      reason: "out_of_axis",
      placeName: null,
      outOfAxisMessage: "Fake out of axis message.",
      freeDeliveryMinPieces: 12,
    });
  });

  it("is free outside every axis from the piece threshold: reason quantity", async () => {
    const answer = await quote(FAR, 12);

    expect(deliveryQuoteResponseSchema.parse(answer.body)).toEqual({
      feeAr: 0,
      reason: "quantity",
      placeName: null,
      outOfAxisMessage: null,
      freeDeliveryMinPieces: 12,
    });
  });

  it("does not count an inactive place", async () => {
    await insertAxis(1, [await insertPlace("Closed Market", false)]);

    const answer = await quote(CENTRE, 1);

    expect(deliveryQuoteResponseSchema.parse(answer.body).reason).toBe("out_of_axis");
  });

  it("does not count an inactive axis", async () => {
    await insertAxis(1, [await insertPlace("Fake Market")], false);

    const answer = await quote(CENTRE, 1);

    expect(deliveryQuoteResponseSchema.parse(answer.body).reason).toBe("out_of_axis");
  });
});
