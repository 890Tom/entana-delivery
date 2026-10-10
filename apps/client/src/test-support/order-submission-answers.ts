import { vi } from "vitest";
import type { Mock } from "vitest";

import { CREATED_BODY } from "./build-order-submission";
import { jsonResponse } from "./stub-fetch";

/** A 201 as the API answers it. */
export const created = (): Response => jsonResponse(CREATED_BODY, 201);

/** An answer with a text that must never be kept. */
export const status = (code: number): Response => new Response("SECRET-TEXT", { status: code });

/** What the screens do once the order is confirmed, as spies. */
export function buildCleanup(): { clearDrafts: Mock<() => void>; clearCart: Mock<() => void> } {
  return { clearDrafts: vi.fn<() => void>(), clearCart: vi.fn<() => void>() };
}
