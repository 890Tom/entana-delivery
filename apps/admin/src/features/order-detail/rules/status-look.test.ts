import { describe, expect, it } from "vitest";

import { STATUS_LOOKS } from "./status-look";

describe("STATUS_LOOKS", () => {
  it("shows a delivered order in green, a cancelled one in red and a confirmed one in blue", () => {
    expect(STATUS_LOOKS.DELIVERED.tone).toBe("success");
    expect(STATUS_LOOKS.CANCELLED.tone).toBe("danger");
    expect(STATUS_LOOKS.CONFIRMED.tone).toBe("confirmed");
  });
});
