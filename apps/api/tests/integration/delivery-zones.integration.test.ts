import { deliveryZoneListResponseSchema } from "@entana/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { DELIVERY_ZONES_CACHE_CONTROL } from "../../src/delivery-quote/delivery-zones.controller.js";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";

const ZONES_PATH = "/api/v1/delivery/zones";
const CENTRE = { lat: -18.9, lng: 47.5 };

describe("the public delivery zones on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  let nextRank = 1;

  beforeEach(async () => {
    await h.client.axisPlace.deleteMany();
    await h.client.deliveryAxis.deleteMany();
    await h.client.place.deleteMany();
    nextRank = 1;
  });

  const insertPlace = async (name: string, isActive = true): Promise<string> =>
    (
      await h.client.place.create({
        data: { name, ...CENTRE, radiusM: 700, active: isActive },
        select: { id: true },
      })
    ).id;
  const insertAxis = async (placeIds: readonly string[], isActive = true): Promise<void> => {
    const rank = nextRank;
    nextRank += 1;
    await h.client.deliveryAxis.create({
      data: {
        name: `Axis ${String(rank)}`,
        rank,
        color: "#2f6b5a",
        active: isActive,
        places: { create: placeIds.map((placeId, index) => ({ placeId, position: index + 1 })) },
      },
    });
  };
  const zoneNames = async (): Promise<string[]> => {
    const answer = await h.get(ZONES_PATH, null);
    return deliveryZoneListResponseSchema.parse(answer.body).zones.map((zone) => zone.name);
  };

  it("lists a place of an active axis with exactly the five public fields, without a session", async () => {
    const id = await insertPlace("Fake Market");
    await insertAxis([id]);

    const answer = await h.get(ZONES_PATH, null);

    expect(answer.status).toBe(200);
    expect(answer.body).toStrictEqual({
      zones: [{ id, name: "Fake Market", latitude: -18.9, longitude: 47.5, radiusM: 700 }],
    });
  });

  it("does not list an inactive place", async () => {
    await insertAxis([await insertPlace("Shown"), await insertPlace("Hidden", false)]);

    expect(await zoneNames()).toEqual(["Shown"]);
  });

  it("does not list a place whose axes are all inactive", async () => {
    await insertAxis([await insertPlace("Shown")]);
    const orphan = await insertPlace("Orphan");
    await insertAxis([orphan], false);
    await insertAxis([orphan], false);

    expect(await zoneNames()).toEqual(["Shown"]);
  });

  it("lists once a place that is in two active axes", async () => {
    const shared = await insertPlace("Shared");
    await insertAxis([shared]);
    await insertAxis([shared]);

    expect(await zoneNames()).toEqual(["Shared"]);
  });

  it("lists the zones by name", async () => {
    await insertAxis([await insertPlace("Cedar"), await insertPlace("Acacia")]);
    await insertAxis([await insertPlace("Baobab")]);

    expect(await zoneNames()).toEqual(["Acacia", "Baobab", "Cedar"]);
  });

  it("lets shared caches keep the list for a short while", async () => {
    const answer = await h.get(ZONES_PATH, null);

    expect(answer.headers["cache-control"]).toBe(DELIVERY_ZONES_CACHE_CONTROL);
  });

  it("answers the strict shape of the contract", async () => {
    await insertAxis([await insertPlace("Fake Market")]);

    const answer = await h.get(ZONES_PATH, null);

    expect(deliveryZoneListResponseSchema.safeParse(answer.body).success).toBe(true);
  });
});
