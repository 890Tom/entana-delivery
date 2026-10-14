import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { FAKE_LAT, FAKE_LNG, buildOrderRequest } from "../support/order-request.js";
import { insertProduct } from "./support/insert-product.js";
import {
  createOrdersService,
  openOrdersClient,
  resetDeliveryRules,
  resetOrderData,
} from "./support/orders-fixtures.js";

const client = openOrdersClient();
const service = createOrdersService(client);
const KEY = "0190a5b2-7c3d-7e4f-8a1b-0000000000f1";
const PRICE_AR = 1000;
const SETTINGS = { outOfAxisFeeAr: 3500, freeDeliveryMinPieces: 12 };
const FAR = { lat: 0, lng: 0 };

// Other values than the shared reset: a fee or a threshold read from a constant would fail here.
async function resetDelivery(): Promise<void> {
  await resetDeliveryRules(client);
  await client.shopSetting.update({ where: { id: 1 }, data: SETTINGS });
}

/** An active axis with one active place around the fake point of the order requests. */
async function insertAxisAroundOrderPoint(): Promise<{ axisId: string; placeId: string }> {
  const place = await client.place.create({
    data: { name: "Fake Market", lat: FAKE_LAT, lng: FAKE_LNG, radiusM: 500, active: true },
    select: { id: true },
  });
  const axis = await client.deliveryAxis.create({
    data: {
      name: "Fake Axis",
      rank: 1,
      color: "#2f6b5a",
      active: true,
      places: { create: [{ placeId: place.id, position: 1 }] },
    },
    select: { id: true },
  });
  return { axisId: axis.id, placeId: place.id };
}

async function createOrder(quantity: number, location = { lat: FAKE_LAT, lng: FAKE_LNG }) {
  const productId = await insertProduct(client, { priceAr: PRICE_AR });
  const request = buildOrderRequest([{ productId, quantity }], { location });
  const { response } = await service.createOrder(request, KEY);
  const stored = await client.customerOrder.findUniqueOrThrow({
    where: { idempotencyKey: KEY },
    select: { deliveryFee: true, feeReason: true, placeId: true, axisId: true, totalAr: true },
  });
  return { response, stored };
}

describe("the delivery fee frozen on an order, on a real PostgreSQL", () => {
  beforeEach(async () => {
    await resetOrderData(client);
    await resetDelivery();
  });

  afterAll(async () => {
    await resetOrderData(client);
    await resetDeliveryRules(client);
    await client.$disconnect();
  });

  it("is free inside an axis, with the place and the axis", async () => {
    const { axisId, placeId } = await insertAxisAroundOrderPoint();

    const { response, stored } = await createOrder(2);

    expect(stored).toEqual({
      deliveryFee: 0,
      feeReason: "IN_AXIS",
      placeId,
      axisId,
      totalAr: 2000,
    });
    expect(response).toMatchObject({ deliveryFeeAr: 0, totalAr: 2000 });
  });

  it("charges the out-of-axis fee of the moment, without place or axis", async () => {
    await insertAxisAroundOrderPoint();

    const { response, stored } = await createOrder(2, FAR);

    expect(stored).toEqual({
      deliveryFee: 3500,
      feeReason: "OUT_OF_AXIS",
      placeId: null,
      axisId: null,
      totalAr: 2000 + 3500,
    });
    expect(response).toMatchObject({ deliveryFeeAr: 3500, totalAr: 5500 });
  });

  it("is free outside every axis from the piece threshold: reason QUANTITY", async () => {
    const { response, stored } = await createOrder(12, FAR);

    expect(stored).toEqual({
      deliveryFee: 0,
      feeReason: "QUANTITY",
      placeId: null,
      axisId: null,
      totalAr: 12_000,
    });
    expect(response).toMatchObject({ deliveryFeeAr: 0, totalAr: 12_000 });
  });

  it("keeps the fee of the order when the settings change afterwards", async () => {
    const { response } = await createOrder(2, FAR);
    await client.shopSetting.update({ where: { id: 1 }, data: { outOfAxisFeeAr: 9000 } });

    const stored = await client.customerOrder.findUniqueOrThrow({
      where: { idempotencyKey: KEY },
      select: { deliveryFee: true, totalAr: true },
    });
    expect(stored).toEqual({ deliveryFee: 3500, totalAr: 5500 });
    expect(response).toMatchObject({ deliveryFeeAr: 3500 });
  });
});
