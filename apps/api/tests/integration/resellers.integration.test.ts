import { resellerListResponseSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { useAdminOrdersHarness } from "./support/admin-orders-harness.js";

const PUBLIC_PATH = "/api/v1/resellers";
const ADMIN_PATH = "/api/v1/admin/resellers";
const EARLIER = new Date("2026-01-01T00:00:00.000Z");

describe("the public list of the resellers on a real PostgreSQL", () => {
  const h = useAdminOrdersHarness();
  const insertReseller = async (overrides: Record<string, unknown> = {}): Promise<string> => {
    const created = await h.client.reseller.create({
      data: {
        name: "Stored Reseller",
        area: "Stored Area",
        landmarkText: "Next to the stored market",
        lat: -18.8,
        lng: 47.4,
        active: true,
        consentAt: EARLIER,
        verifiedAt: EARLIER,
        ...overrides,
      },
      select: { id: true },
    });
    return created.id;
  };
  const publicIds = async (): Promise<string[]> => {
    const answer = await h.get(PUBLIC_PATH, null);
    return resellerListResponseSchema.parse(answer.body).resellers.map((entry) => entry.id);
  };

  it("answers 200 without a session cookie, with exactly the six public fields", async () => {
    const id = await insertReseller({ name: "A", area: "North" });

    const answer = await h.get(PUBLIC_PATH, null);

    expect(answer.status).toBe(200);
    expect(answer.body).toStrictEqual({
      resellers: [
        {
          id,
          name: "A",
          neighborhood: "North",
          landmark: "Next to the stored market",
          latitude: -18.8,
          longitude: 47.4,
        },
      ],
    });
    expect(answer.headers["cache-control"]).toBe("public, max-age=30");
  });

  it("lists the visible resellers by neighborhood, then name, then id", async () => {
    const lowId = "00000000-0000-4000-8000-000000000001";
    const highId = "00000000-0000-4000-8000-000000000002";
    const northB = await insertReseller({ name: "B", area: "North" });
    const eastHigh = await insertReseller({ id: highId, name: "Z", area: "East" });
    const eastLow = await insertReseller({ id: lowId, name: "Z", area: "East" });
    const northA = await insertReseller({ name: "A", area: "North" });

    expect(await publicIds()).toEqual([eastLow, eastHigh, northA, northB]);
  });

  it("does not list a reseller that is not visible", async () => {
    const shown = await insertReseller({ name: "Shown" });
    await insertReseller({ name: "Hidden", active: false, consentAt: null });

    expect(await publicIds()).toEqual([shown]);
  });

  it("does not list a reseller that was deleted", async () => {
    const kept = await insertReseller({ name: "Kept" });
    const removed = await insertReseller({ name: "Removed" });
    const deletion = await h.delete(`${ADMIN_PATH}/${removed}`);
    expect(deletion.status).toBe(204);

    expect(await publicIds()).toEqual([kept]);
  });

  it("answers 200 with an empty array when no reseller exists", async () => {
    const answer = await h.get(PUBLIC_PATH, null);

    expect(answer.status).toBe(200);
    expect(answer.body).toStrictEqual({ resellers: [] });
  });
});
