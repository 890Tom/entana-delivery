import type { AdminOrderDetail } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { buildHistory } from "./history";

type Event = AdminOrderDetail["events"][number];

function event(overrides: Partial<Event>): Event {
  return {
    type: "STATUS_CHANGED",
    fromStatus: null,
    toStatus: "NEW",
    createdAt: "2026-10-01T06:47:00.000Z",
    actor: { type: "CUSTOMER", id: null },
    ...overrides,
  };
}

describe("buildHistory", () => {
  it("keeps the status changes only, oldest first, with who made them", () => {
    const events: Event[] = [
      event({
        fromStatus: "NEW",
        toStatus: "CONFIRMED",
        createdAt: "2026-10-01T07:00:00.000Z",
        actor: { type: "STAFF", id: "6f1c2d4e-8a3b-4c5d-9e7f-1a2b3c4d5e6f" },
      }),
      event({ type: "LINES_EDITED", toStatus: null, createdAt: "2026-10-01T06:50:00.000Z" }),
      event({}),
      event({
        fromStatus: "CONFIRMED",
        toStatus: "CANCELLED",
        createdAt: "2026-10-01T08:00:00.000Z",
        actor: { type: "SYSTEM", id: null },
      }),
    ];

    expect(buildHistory(events)).toEqual([
      { status: "NEW", actor: "CUSTOMER", createdAt: "2026-10-01T06:47:00.000Z" },
      { status: "CONFIRMED", actor: "STAFF", createdAt: "2026-10-01T07:00:00.000Z" },
      { status: "CANCELLED", actor: "SYSTEM", createdAt: "2026-10-01T08:00:00.000Z" },
    ]);
  });
});
