import { afterEach, describe, expect, it, vi } from "vitest";

import { formatDeliveryDate, formatDeliveryDateTitle } from "./format-delivery-date";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the delivery day", () => {
  it.each(["Pacific/Kiritimati", "America/Los_Angeles", "Indian/Antananarivo"])(
    "is the calendar day written in the date, in the time zone %s",
    (timeZone) => {
      vi.stubEnv("TZ", timeZone);

      expect(formatDeliveryDate("2026-10-02")).toBe("vendredi 2 octobre");
      expect(formatDeliveryDateTitle("2026-10-02")).toBe("Vendredi 2 octobre");
    },
  );
});
