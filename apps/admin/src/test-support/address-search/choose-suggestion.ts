import type { PlaceSuggestion } from "@entana/contracts";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { jsonResponse, ROUTES } from "../stubs/stub-api";
import type { ApiStub } from "../stubs/stub-api";

export const addressField = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("combobox", { name: texts.addressSearch.label });

/**
 * Waits for the map to be ready (the field becomes active), then searches with a simulated clock
 * and chooses the suggestion that the place search answers.
 */
export async function chooseSuggestion(api: ApiStub, suggestion: PlaceSuggestion): Promise<void> {
  api.answer(ROUTES.placesSearch, () => jsonResponse({ suggestions: [suggestion] }));
  await waitFor(() => {
    expect(addressField().getAttribute("aria-disabled")).toBeNull();
  });
  vi.useFakeTimers();
  fireEvent.change(addressField(), { target: { value: "analakely" } });
  await act(() => vi.advanceTimersByTimeAsync(400));
  vi.useRealTimers();
  fireEvent.click(screen.getByRole("option", { name: suggestion.label }));
}
