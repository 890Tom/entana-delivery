import { adminDeliveryAxisSchema } from "@entana/contracts";
import { MAX_DELIVERY_AXES } from "@entana/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";

const AXES_PATH = "/api/v1/admin/delivery/axes";
const ORDER_PATH = `${AXES_PATH}/order`;
const UNKNOWN_ID = "0192b8a0-0000-7000-8000-00000000dead";
const NEW_PLACE = { name: "Fake new place", latitude: -18.9, longitude: 47.5 };

describe("the writes of the delivery axes on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();

  beforeEach(async () => {
    await h.client.customerOrder.updateMany({ data: { axisId: null } });
    await h.client.axisPlace.deleteMany();
    await h.client.deliveryAxis.deleteMany();
    await h.client.place.deleteMany();
    await h.client.auditLog.deleteMany();
  });

  const insertPlace = async (name: string, isActive = true): Promise<string> =>
    (
      await h.client.place.create({
        data: { name, lat: -18.9, lng: 47.5, radiusM: 500, active: isActive },
        select: { id: true },
      })
    ).id;
  const insertAxis = async (
    name: string,
    rank: number,
    colorKey: number,
    placeIds: readonly string[] = [],
  ): Promise<string> =>
    (
      await h.client.deliveryAxis.create({
        data: {
          name,
          rank,
          colorKey,
          active: true,
          places: { create: placeIds.map((placeId, index) => ({ placeId, position: index + 1 })) },
        },
        select: { id: true },
      })
    ).id;
  const body = (places: readonly unknown[], extra: Record<string, unknown> = {}) => ({
    name: "Fake axis",
    active: true,
    places,
    ...extra,
  });
  const audit = async () =>
    (await h.client.auditLog.findMany({ orderBy: { id: "asc" } })).map((row) => ({
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      diff: row.diff,
    }));
  const axisRows = () =>
    h.client.deliveryAxis.findMany({ orderBy: { rank: "asc" }, select: { id: true, rank: true } });

  describe("without a session", () => {
    it("closes the four write routes with the same 401", async () => {
      const answers = await Promise.all([
        h.post(AXES_PATH, body([{ placeId: UNKNOWN_ID }]), null),
        h.put(`${AXES_PATH}/${UNKNOWN_ID}`, body([{ placeId: UNKNOWN_ID }]), null),
        h.put(ORDER_PATH, { ids: [] }, null),
        h.delete(`${AXES_PATH}/${UNKNOWN_ID}`, null),
      ]);

      expect(answers.map((answer) => answer.status)).toEqual([401, 401, 401, 401]);
    });
  });

  describe("POST /axes", () => {
    it("creates the axis last, with the smallest free colour and the places in order", async () => {
      const existingPlace = await insertPlace("Existing place");
      await insertAxis("First axis", 4, 0);
      await insertAxis("Third axis", 6, 2);

      const answer = await h.post(
        AXES_PATH,
        body([NEW_PLACE, { placeId: existingPlace }], { name: "  New axis  " }),
      );

      const axis = adminDeliveryAxisSchema.parse(answer.body);
      expect(answer.status).toBe(201);
      expect([axis.name, axis.rank, axis.colorKey]).toEqual(["New axis", 7, 1]);
      expect(axis.places.map((place) => place.name)).toEqual(["Fake new place", "Existing place"]);
      expect(axis.places[0]?.radiusM).toBe(500);
      const created = await h.client.place.findFirstOrThrow({ where: { name: "Fake new place" } });
      expect((await audit()).map((entry) => [entry.action, entry.entityId, entry.diff])).toEqual([
        ["delivery_axis.created", axis.id, { active: true, places: 2 }],
        ["delivery_place.created", created.id, {}],
      ]);
    });

    it("refuses a new axis when the maximum number of axes exists", async () => {
      for (let index = 0; index < MAX_DELIVERY_AXES; index += 1) {
        await insertAxis(`Axis ${String(index)}`, index + 1, index);
      }

      const answer = await h.post(AXES_PATH, body([NEW_PLACE]));

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({
        type: "urn:entana:problem:delivery_axis_limit_reached",
      });
    });

    it("answers 409 for an axis name taken in another case, and writes nothing", async () => {
      await insertAxis("North", 1, 0);

      const answer = await h.post(AXES_PATH, body([NEW_PLACE], { name: "NORTH" }));

      expect(answer.status).toBe(409);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:delivery_axis_name_taken" });
      expect(await h.client.place.count()).toBe(0);
    });

    it("answers 409 for a new place name that exists, in another case", async () => {
      await insertPlace("Analakely");

      const answer = await h.post(AXES_PATH, body([{ ...NEW_PLACE, name: "ANALAKELY" }]));

      expect(answer.status).toBe(409);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:delivery_place_name_taken" });
    });

    it("answers 409 for the same new place name twice in the body", async () => {
      const answer = await h.post(
        AXES_PATH,
        body([NEW_PLACE, { ...NEW_PLACE, name: "fake NEW place", latitude: -19 }]),
      );

      expect(answer.status).toBe(409);
      expect(await h.client.place.count()).toBe(0);
    });

    it.each([
      ["an empty list of places", body([])],
      ["the same placeId twice", body([{ placeId: UNKNOWN_ID }, { placeId: UNKNOWN_ID }])],
      ["an empty axis name", body([NEW_PLACE], { name: "   " })],
    ])("answers 400 for %s", async (_label, invalid) => {
      const answer = await h.post(AXES_PATH, invalid);

      expect(answer.status).toBe(400);
    });

    it("answers 422 for an unknown placeId and for an inactive one", async () => {
      const inactive = await insertPlace("Inactive place", false);

      const unknown = await h.post(AXES_PATH, body([{ placeId: UNKNOWN_ID }]));
      const refused = await h.post(AXES_PATH, body([{ placeId: inactive }]));

      expect([unknown.status, refused.status]).toEqual([422, 422]);
      expect(refused.body).toMatchObject({
        type: "urn:entana:problem:delivery_place_unavailable",
      });
    });

    it("never gives the same rank or colour to two simultaneous creations", async () => {
      const answers = await Promise.all(
        ["One", "Two", "Three", "Four"].map((name) =>
          h.post(AXES_PATH, body([{ ...NEW_PLACE, name: `Place ${name}` }], { name })),
        ),
      );

      const axes = answers.map((answer) => adminDeliveryAxisSchema.parse(answer.body));
      expect(answers.map((answer) => answer.status)).toEqual([201, 201, 201, 201]);
      expect(new Set(axes.map((axis) => axis.rank)).size).toBe(4);
      expect(new Set(axes.map((axis) => axis.colorKey)).size).toBe(4);
    });
  });

  describe("PUT /axes/:id", () => {
    it("changes the name, the state and the places, and keeps the removed place", async () => {
      const first = await insertPlace("First place");
      const second = await insertPlace("Second place");
      const axisId = await insertAxis("North", 1, 3, [first, second]);

      const answer = await h.put(
        `${AXES_PATH}/${axisId}`,
        body([NEW_PLACE, { placeId: second }], { name: "South", active: false }),
      );

      const axis = adminDeliveryAxisSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect([axis.name, axis.active, axis.rank, axis.colorKey]).toEqual(["South", false, 1, 3]);
      expect(axis.places.map((place) => place.name)).toEqual(["Fake new place", "Second place"]);
      expect(await h.client.place.findUnique({ where: { id: first } })).not.toBeNull();
      const [updated, createdPlace] = await audit();
      expect(updated).toMatchObject({
        action: "delivery_axis.updated",
        entityId: axisId,
        diff: { fields: ["name", "active", "places"] },
      });
      expect(createdPlace).toMatchObject({ action: "delivery_place.created" });
    });

    it("renumbers the positions when the order of the places changes", async () => {
      const first = await insertPlace("First place");
      const second = await insertPlace("Second place");
      const axisId = await insertAxis("North", 1, 0, [first, second]);

      const answer = await h.put(
        `${AXES_PATH}/${axisId}`,
        body([{ placeId: second }, { placeId: first }], { name: "North" }),
      );

      expect(answer.status).toBe(200);
      expect((await audit()).map((entry) => entry.diff)).toEqual([{ fields: ["places"] }]);
      const links = await h.client.axisPlace.findMany({
        where: { axisId },
        orderBy: { position: "asc" },
      });
      expect(links.map((link) => [link.placeId, link.position])).toEqual([
        [second, 1],
        [first, 2],
      ]);
    });

    it("writes no audit entry when nothing changes", async () => {
      const placeId = await insertPlace("First place");
      const axisId = await insertAxis("North", 1, 0, [placeId]);

      const answer = await h.put(`${AXES_PATH}/${axisId}`, body([{ placeId }], { name: "North" }));

      expect(answer.status).toBe(200);
      expect(await audit()).toEqual([]);
    });

    it("keeps an inactive place that the axis already holds", async () => {
      const inactive = await insertPlace("Old place", false);
      const axisId = await insertAxis("North", 1, 0, [inactive]);

      const answer = await h.put(
        `${AXES_PATH}/${axisId}`,
        body([{ placeId: inactive }], { name: "North", active: false }),
      );

      expect(answer.status).toBe(200);
    });

    it("refuses to add an inactive place to an axis", async () => {
      const inactive = await insertPlace("Old place", false);
      const placeId = await insertPlace("First place");
      const axisId = await insertAxis("North", 1, 0, [placeId]);

      const answer = await h.put(
        `${AXES_PATH}/${axisId}`,
        body([{ placeId }, { placeId: inactive }], { name: "North" }),
      );

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({
        type: "urn:entana:problem:delivery_place_unavailable",
      });
    });

    it("answers 409 when the name is taken by another axis, and 404 for an unknown id", async () => {
      await insertAxis("Taken", 1, 0);
      const axisId = await insertAxis("North", 2, 1);

      const taken = await h.put(`${AXES_PATH}/${axisId}`, body([NEW_PLACE], { name: "taken" }));
      const unknown = await h.put(`${AXES_PATH}/${UNKNOWN_ID}`, body([NEW_PLACE]));

      expect([taken.status, unknown.status]).toEqual([409, 404]);
    });
  });

  describe("PUT /axes/order", () => {
    it("gives the ranks 1..n and audits each axis that moves", async () => {
      const a = await insertAxis("A", 1, 0);
      const b = await insertAxis("B", 2, 1);
      const c = await insertAxis("C", 5, 2);

      const answer = await h.put(ORDER_PATH, { ids: [c, a, b] });

      expect(answer.status).toBe(200);
      expect((await axisRows()).map((axis) => [axis.id, axis.rank])).toEqual([
        [c, 1],
        [a, 2],
        [b, 3],
      ]);
      expect((await audit()).map((entry) => [entry.entityId, entry.diff])).toEqual([
        [c, { from: 5, to: 1 }],
        [a, { from: 1, to: 2 }],
        [b, { from: 2, to: 3 }],
      ]);
    });

    it("writes nothing when the order is the same", async () => {
      const a = await insertAxis("A", 1, 0);
      const b = await insertAxis("B", 2, 1);

      const answer = await h.put(ORDER_PATH, { ids: [a, b] });

      expect(answer.status).toBe(200);
      expect(await audit()).toEqual([]);
    });

    it.each([
      ["an incomplete list", (ids: string[]) => ids.slice(1)],
      ["a duplicate", (ids: string[]) => [ids[0] ?? "", ...ids]],
    ])("answers 422 for %s", async (_label, mutate) => {
      const ids = [await insertAxis("A", 1, 0), await insertAxis("B", 2, 1)];

      const answer = await h.put(ORDER_PATH, { ids: mutate(ids) });

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({
        type: "urn:entana:problem:delivery_axis_order_mismatch",
      });
    });
  });

  describe("DELETE /axes/:id", () => {
    it("removes an axis without order, keeps its places and frees its colour", async () => {
      const placeId = await insertPlace("First place");
      await insertAxis("Keep", 1, 0);
      const axisId = await insertAxis("Remove", 2, 1, [placeId]);

      const answer = await h.delete(`${AXES_PATH}/${axisId}`);

      expect(answer.status).toBe(204);
      expect(await h.client.deliveryAxis.findUnique({ where: { id: axisId } })).toBeNull();
      expect(await h.client.place.findUnique({ where: { id: placeId } })).not.toBeNull();
      expect(await audit()).toEqual([
        { action: "delivery_axis.deleted", entity: "delivery_axis", entityId: axisId, diff: {} },
      ]);
      const next = await h.post(AXES_PATH, body([{ placeId }], { name: "Next" }));
      expect(adminDeliveryAxisSchema.parse(next.body).colorKey).toBe(1);
    });

    it("answers 409 for an axis that an order references", async () => {
      const axisId = await insertAxis("Used", 1, 0);
      const order = await h.placeOrder();
      await h.client.customerOrder.update({ where: { id: order.id }, data: { axisId } });

      const answer = await h.delete(`${AXES_PATH}/${axisId}`);

      expect(answer.status).toBe(409);
      expect(answer.body).toMatchObject({ type: "urn:entana:problem:delivery_axis_in_use" });
      expect(await h.client.deliveryAxis.findUnique({ where: { id: axisId } })).not.toBeNull();
    });

    it("answers 404 for an unknown id", async () => {
      const answer = await h.delete(`${AXES_PATH}/${UNKNOWN_ID}`);

      expect(answer.status).toBe(404);
    });
  });
});
