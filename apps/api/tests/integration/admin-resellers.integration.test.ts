import { adminResellerListResponseSchema, adminResellerSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";

const RESELLERS_PATH = "/api/v1/admin/resellers";
const UNKNOWN_ID = "0199f5b0-7c1e-7a3b-9d4f-2b6e8a1c3d5f";
const NOT_FOUND = { status: 404, detail: "The requested resource was not found." };
const NOT_PUBLISHABLE_TYPE = "urn:entana:problem:reseller_not_publishable";
const VALID = {
  name: "Demo Reseller",
  neighborhood: "Demo Area",
  landmark: "Next to the fake market",
  latitude: -18.9,
  longitude: 47.5,
};
const EARLIER = new Date("2026-01-01T00:00:00.000Z");

describe("the administration of the resellers on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  const resellerPath = (id: string): string => `${RESELLERS_PATH}/${id}`;
  const auditRows = () => h.client.auditLog.findMany({ orderBy: { id: "asc" } });
  const actions = async (): Promise<string[]> => (await auditRows()).map((row) => row.action);
  const insertReseller = async (overrides: Record<string, unknown> = {}): Promise<string> => {
    const created = await h.client.reseller.create({
      data: {
        name: "Stored Reseller",
        area: "Stored Area",
        landmarkText: "Next to the stored market",
        lat: -18.8,
        lng: 47.4,
        active: false,
        consentAt: null,
        verifiedAt: EARLIER,
        ...overrides,
      },
      select: { id: true },
    });
    return created.id;
  };
  const stored = (id: string) => h.client.reseller.findUniqueOrThrow({ where: { id } });

  describe("without a session", () => {
    it("closes the five routes with the same 401", async () => {
      const calls = [
        h.get(RESELLERS_PATH, null),
        h.post(RESELLERS_PATH, VALID, null),
        h.patch(resellerPath(UNKNOWN_ID), { visible: false }, null),
        h.post(`${resellerPath(UNKNOWN_ID)}/verify`, {}, null),
        h.delete(resellerPath(UNKNOWN_ID), null),
      ];

      const answers = await Promise.all(calls);

      expect(answers.map((answer) => answer.status)).toEqual([401, 401, 401, 401, 401]);
    });
  });

  describe("the list", () => {
    it("holds every reseller by neighborhood then name, with the planned fields", async () => {
      const east = await insertReseller({ name: "B", area: "East" });
      const northB = await insertReseller({ name: "B", area: "North" });
      const northA = await insertReseller({
        name: "A",
        area: "North",
        active: true,
        consentAt: EARLIER,
        verifiedAt: null,
      });

      const answer = await h.get(RESELLERS_PATH);

      const { resellers } = adminResellerListResponseSchema.parse(answer.body);
      expect(answer.status).toBe(200);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(resellers.map((reseller) => reseller.id)).toEqual([east, northA, northB]);
      expect(resellers[1]).toEqual({
        id: northA,
        name: "A",
        neighborhood: "North",
        landmark: "Next to the stored market",
        latitude: -18.8,
        longitude: 47.4,
        consentGiven: true,
        visible: true,
        verifiedAt: null,
      });
    });
  });

  describe("the creation", () => {
    it("fills the columns, applies the defaults, verifies now and writes the audit", async () => {
      const answer = await h.post(RESELLERS_PATH, VALID);

      const reseller = adminResellerSchema.parse(answer.body);
      expect(answer.status).toBe(201);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(reseller).toMatchObject({
        ...VALID,
        consentGiven: false,
        visible: false,
        verifiedAt: h.clock.now().toISOString(),
      });
      expect(await stored(reseller.id)).toMatchObject({
        name: "Demo Reseller",
        area: "Demo Area",
        landmarkText: "Next to the fake market",
        lat: -18.9,
        lng: 47.5,
        active: false,
        consentAt: null,
        verifiedAt: h.clock.now(),
      });
      expect(await auditRows()).toMatchObject([
        {
          actorId: h.adminId,
          action: "reseller.created",
          entity: "reseller",
          entityId: reseller.id,
          diff: { visible: false, consentGiven: false },
        },
      ]);
    });

    it("dates the consent now when it is given, and can be visible at once", async () => {
      const answer = await h.post(RESELLERS_PATH, { ...VALID, consentGiven: true, visible: true });

      const reseller = adminResellerSchema.parse(answer.body);
      expect(answer.status).toBe(201);
      expect(reseller).toMatchObject({ consentGiven: true, visible: true });
      expect((await stored(reseller.id)).consentAt).toEqual(h.clock.now());
    });

    it.each([
      ["without a latitude", { ...VALID, latitude: undefined }],
      ["without a longitude", { ...VALID, longitude: undefined }],
      ["without a landmark", { ...VALID, landmark: undefined }],
      ["with a field of more", { ...VALID, phone: "0340000000" }],
    ])("answers 400 %s and writes nothing", async (_name, body) => {
      const answer = await h.post(RESELLERS_PATH, body);

      expect(answer.status).toBe(400);
      expect(await h.client.reseller.count()).toBe(0);
      expect(await auditRows()).toEqual([]);
    });

    it("answers 422 reseller_not_publishable for visible without the consent", async () => {
      const answer = await h.post(RESELLERS_PATH, { ...VALID, visible: true, consentGiven: false });

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ type: NOT_PUBLISHABLE_TYPE });
      expect(await h.client.reseller.count()).toBe(0);
    });
  });

  describe("the update", () => {
    it("changes the fields, answers the reseller and writes one audit entry", async () => {
      const id = await insertReseller();

      const answer = await h.patch(resellerPath(id), {
        name: "New name",
        latitude: -18.7,
        longitude: 47.3,
      });

      expect(answer.status).toBe(200);
      expect(adminResellerSchema.parse(answer.body)).toMatchObject({
        id,
        name: "New name",
        latitude: -18.7,
        longitude: 47.3,
      });
      expect(await stored(id)).toMatchObject({ name: "New name", lat: -18.7, lng: 47.3 });
      expect(await auditRows()).toMatchObject([
        {
          action: "reseller.updated",
          entityId: id,
          diff: { fields: ["name", "latitude", "longitude"] },
        },
      ]);
    });

    it("gives the consent dated now, then publishes: consent and visibility are audited", async () => {
      const id = await insertReseller();

      const answer = await h.patch(resellerPath(id), { consentGiven: true, visible: true });

      expect(answer.status).toBe(200);
      expect((await stored(id)).consentAt).toEqual(h.clock.now());
      expect(await auditRows()).toMatchObject([
        { action: "reseller.consent_changed", diff: { consentGiven: { from: false, to: true } } },
        { action: "reseller.published", diff: { visible: { from: false, to: true } } },
      ]);
    });

    it("keeps the date of a consent already given when other fields change", async () => {
      const id = await insertReseller({ consentAt: EARLIER });

      await h.patch(resellerPath(id), { consentGiven: true, name: "Renamed" });

      expect((await stored(id)).consentAt).toEqual(EARLIER);
      expect(await actions()).toEqual(["reseller.updated"]);
    });

    it("hides a visible reseller with an unpublished entry", async () => {
      const id = await insertReseller({ active: true, consentAt: EARLIER });

      const answer = await h.patch(resellerPath(id), { visible: false });

      expect(answer.status).toBe(200);
      expect((await stored(id)).active).toBe(false);
      expect(await actions()).toEqual(["reseller.unpublished"]);
    });

    it("answers 422 and changes nothing when the consent of a visible reseller is withdrawn", async () => {
      const id = await insertReseller({ active: true, consentAt: EARLIER });

      const answer = await h.patch(resellerPath(id), { consentGiven: false });

      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ type: NOT_PUBLISHABLE_TYPE });
      expect(await stored(id)).toMatchObject({ active: true, consentAt: EARLIER });
      expect(await auditRows()).toEqual([]);
    });

    it("withdraws the consent when the same change hides the reseller", async () => {
      const id = await insertReseller({ active: true, consentAt: EARLIER });

      await h.patch(resellerPath(id), { consentGiven: false, visible: false });

      expect(await stored(id)).toMatchObject({ active: false, consentAt: null });
      expect(await actions()).toEqual(["reseller.consent_changed", "reseller.unpublished"]);
    });

    it("answers 422 for visible: true without the consent", async () => {
      const id = await insertReseller();

      const answer = await h.patch(resellerPath(id), { visible: true });

      expect(answer.status).toBe(422);
      expect((await stored(id)).active).toBe(false);
    });

    it("answers 200 and writes no audit entry when no value changes", async () => {
      const id = await insertReseller();

      const answer = await h.patch(resellerPath(id), { name: "Stored Reseller", visible: false });

      expect(answer.status).toBe(200);
      expect(await auditRows()).toEqual([]);
    });

    it("answers 400 for an empty body and for a latitude without a longitude", async () => {
      const id = await insertReseller();

      const answers = await Promise.all([
        h.patch(resellerPath(id), {}),
        h.patch(resellerPath(id), { latitude: -18.7 }),
      ]);

      expect(answers.map((answer) => answer.status)).toEqual([400, 400]);
    });

    it("answers the same 404 for an unknown and for a malformed id", async () => {
      const answers = await Promise.all([
        h.patch(resellerPath(UNKNOWN_ID), { visible: false }),
        h.patch(resellerPath("not-an-id"), { visible: false }),
      ]);

      for (const answer of answers) {
        expect(answer.status).toBe(NOT_FOUND.status);
        expect(answer.body).toMatchObject(NOT_FOUND);
      }
    });
  });

  describe("the verification", () => {
    it("dates the verification now and writes the audit entry, every time", async () => {
      const id = await insertReseller({ verifiedAt: null });

      const first = await h.post(`${resellerPath(id)}/verify`, {});
      const second = await h.post(`${resellerPath(id)}/verify`, {});

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(adminResellerSchema.parse(first.body).verifiedAt).toBe(h.clock.now().toISOString());
      expect((await stored(id)).verifiedAt).toEqual(h.clock.now());
      expect(await actions()).toEqual(["reseller.verified", "reseller.verified"]);
    });

    it("answers 404 for an unknown id", async () => {
      const answer = await h.post(`${resellerPath(UNKNOWN_ID)}/verify`, {});

      expect(answer.status).toBe(404);
    });
  });

  describe("the deletion", () => {
    it("removes the reseller for good, answers 204 and keeps the id only in the audit", async () => {
      const id = await insertReseller({ name: "Secret Name" });

      const answer = await h.delete(resellerPath(id));

      expect(answer.status).toBe(204);
      expect(answer.headers["cache-control"]).toBe("no-store");
      expect(answer.text).toBe("");
      const list = adminResellerListResponseSchema.parse((await h.get(RESELLERS_PATH)).body);
      expect(list.resellers).toEqual([]);
      const audit = await auditRows();
      expect(audit).toMatchObject([
        { action: "reseller.deleted", entity: "reseller", entityId: id, diff: {} },
      ]);
      expect(JSON.stringify(audit)).not.toContain("Secret Name");
    });

    it("answers 404 for an unknown id and writes no audit entry", async () => {
      const answer = await h.delete(resellerPath(UNKNOWN_ID));

      expect(answer.status).toBe(404);
      expect(await auditRows()).toEqual([]);
    });
  });
});
