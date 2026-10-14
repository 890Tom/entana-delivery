import {
  adminDeliveryAxisListResponseSchema,
  adminDeliveryPlaceListResponseSchema,
  deliveryResolveResponseSchema,
  deliverySettingsSchema,
} from "@entana/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";

const DELIVERY_PATH = "/api/v1/admin/delivery";
const SETTINGS_PATH = `${DELIVERY_PATH}/settings`;
const SETTINGS_AUDIT_ENTITY_ID = "00000000-0000-0000-0000-000000000001";
const STORED_SETTINGS = {
  outOfAxisFeeAr: 4000,
  freeDeliveryMinPieces: 20,
  outOfAxisMessage: "Fake out of axis message.",
};
const CENTRE = { latitude: -18.9, longitude: 47.5 };
const FAR = { latitude: 0, longitude: 0 };

describe("the delivery administration on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();

  beforeEach(async () => {
    await h.client.axisPlace.deleteMany();
    await h.client.deliveryAxis.deleteMany();
    await h.client.place.deleteMany();
    await h.client.shopSetting.update({ where: { id: 1 }, data: STORED_SETTINGS });
  });

  const insertPlace = async (
    name: string,
    isActive = true,
    lat = CENTRE.latitude,
  ): Promise<string> =>
    (
      await h.client.place.create({
        data: { name, lat, lng: CENTRE.longitude, radiusM: 500, active: isActive },
        select: { id: true },
      })
    ).id;
  const insertAxis = async (
    name: string,
    rank: number,
    placeIds: readonly string[],
    isActive = true,
  ): Promise<string> =>
    (
      await h.client.deliveryAxis.create({
        data: {
          name,
          rank,
          color: "#2f6b5a",
          active: isActive,
          places: {
            create: placeIds.map((placeId, index) => ({ placeId, position: index + 1 })),
          },
        },
        select: { id: true },
      })
    ).id;
  const resolve = (query: string) => h.get(`${DELIVERY_PATH}/resolve?${query}`);
  const point = (coordinates: { latitude: number; longitude: number }, extra = ""): string =>
    `latitude=${String(coordinates.latitude)}&longitude=${String(coordinates.longitude)}${extra}`;

  describe("without a session", () => {
    it("closes the five routes with the same 401", async () => {
      const answers = await Promise.all([
        h.get(`${DELIVERY_PATH}/axes`, null),
        h.get(`${DELIVERY_PATH}/places`, null),
        h.get(SETTINGS_PATH, null),
        h.patch(SETTINGS_PATH, { outOfAxisFeeAr: 1 }, null),
        h.get(`${DELIVERY_PATH}/resolve?${point(CENTRE)}`, null),
      ]);

      expect(answers.map((answer) => answer.status)).toEqual([401, 401, 401, 401, 401]);
    });
  });

  describe("the axes", () => {
    it("lists every axis by rank, places by position, with the other axes of each place", async () => {
      const shared = await insertPlace("Shared");
      const first = await insertPlace("First", false);
      const second = await insertAxis("Second axis", 2, [shared], false);
      const firstAxis = await insertAxis("First axis", 1, [first, shared]);

      const answer = await h.get(`${DELIVERY_PATH}/axes`);

      const { axes } = adminDeliveryAxisListResponseSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(axes.map((axis) => axis.id)).toEqual([firstAxis, second]);
      expect(axes[0]?.places.map((place) => [place.name, place.active])).toEqual([
        ["First", false],
        ["Shared", true],
      ]);
      expect(axes[0]?.places[1]?.alsoIn).toEqual([{ id: second, name: "Second axis" }]);
      expect(axes[1]?.places[0]?.alsoIn).toEqual([{ id: firstAxis, name: "First axis" }]);
      expect(axes[0]?.places[0]?.alsoIn).toEqual([]);
    });
  });

  describe("the places", () => {
    it("lists the active places only, by name", async () => {
      await insertPlace("Zeta");
      await insertPlace("Hidden", false);
      await insertPlace("Alpha");

      const answer = await h.get(`${DELIVERY_PATH}/places`);

      const { places } = adminDeliveryPlaceListResponseSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(places.map((place) => place.name)).toEqual(["Alpha", "Zeta"]);
    });
  });

  describe("the settings", () => {
    it("reads the three values", async () => {
      const answer = await h.get(SETTINGS_PATH);

      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(deliverySettingsSchema.parse(answer.body)).toEqual(STORED_SETTINGS);
    });

    it("changes one field, keeps the others and audits the names and the numbers", async () => {
      const answer = await h.patch(SETTINGS_PATH, { outOfAxisFeeAr: 5000 });

      expect(answer.status).toBe(200);
      expect(deliverySettingsSchema.parse(answer.body)).toEqual({
        ...STORED_SETTINGS,
        outOfAxisFeeAr: 5000,
      });
      expect(await h.client.shopSetting.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({
        ...STORED_SETTINGS,
        outOfAxisFeeAr: 5000,
      });
      expect(await h.client.auditLog.findMany()).toMatchObject([
        {
          actorId: h.adminId,
          action: "delivery_settings.updated",
          entity: "shop_setting",
          entityId: SETTINGS_AUDIT_ENTITY_ID,
          diff: { fields: ["outOfAxisFeeAr"], outOfAxisFeeAr: { from: 4000, to: 5000 } },
        },
      ]);
    });

    it("never writes the text of the message to the audit", async () => {
      await h.patch(SETTINGS_PATH, { outOfAxisMessage: "A brand new text." });

      const [entry] = await h.client.auditLog.findMany();
      expect(entry?.diff).toEqual({ fields: ["outOfAxisMessage"] });
    });

    it("writes no audit when the value sent is the stored one", async () => {
      const answer = await h.patch(SETTINGS_PATH, { outOfAxisFeeAr: 4000 });

      expect(answer.status).toBe(200);
      expect(await h.client.auditLog.count()).toBe(0);
    });

    it.each([
      ["a negative fee", { outOfAxisFeeAr: -1 }],
      ["a threshold of 0", { freeDeliveryMinPieces: 0 }],
      ["an empty message", { outOfAxisMessage: "   " }],
      ["a message of 201 characters", { outOfAxisMessage: "a".repeat(201) }],
    ])("answers 400 for %s and writes nothing", async (_name, body) => {
      const answer = await h.patch(SETTINGS_PATH, body);

      expect(answer.status).toBe(400);
      expect(await h.client.auditLog.count()).toBe(0);
      expect(await h.client.shopSetting.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject(
        STORED_SETTINGS,
      );
    });
  });

  describe("the test of an address", () => {
    it("matches a place of an active axis: free, reason axis", async () => {
      const placeId = await insertPlace("Market");
      const axisId = await insertAxis("North", 1, [placeId]);

      const answer = await resolve(point(CENTRE));

      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(deliveryResolveResponseSchema.parse(answer.body)).toEqual({
        match: {
          axis: { id: axisId, name: "North", color: "#2f6b5a" },
          place: { id: placeId, name: "Market" },
        },
        feeAr: 0,
        reason: "axis",
      });
    });

    it("charges the out-of-axis fee away from every place", async () => {
      await insertAxis("North", 1, [await insertPlace("Market")]);

      const answer = await resolve(point(FAR));

      expect(deliveryResolveResponseSchema.parse(answer.body)).toEqual({
        match: null,
        feeAr: 4000,
        reason: "out_of_axis",
      });
    });

    it("is free at the piece threshold: reason quantity", async () => {
      const answer = await resolve(point(FAR, "&pieces=20"));

      expect(deliveryResolveResponseSchema.parse(answer.body)).toEqual({
        match: null,
        feeAr: 0,
        reason: "quantity",
      });
    });

    it("answers 400 for a latitude out of range", async () => {
      const answer = await resolve("latitude=91&longitude=47.5");

      expect(answer.status).toBe(400);
    });
  });
});
