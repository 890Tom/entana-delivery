import type { PlaceSuggestion } from "@entana/contracts";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { texts } from "../../i18n/texts";
import { buildPlaceSuggestion } from "../../test-support/builders/build-place-suggestion";
import {
  jsonResponse,
  networkFailure,
  problemResponse,
  ROUTES,
  stubApi,
} from "../../test-support/stubs/stub-api";
import type { ApiStub, Handler } from "../../test-support/stubs/stub-api";

import { AddressSearch } from "./address-search";

const t = texts.addressSearch;
const FIVE = [1, 2, 3, 4, 5].map((index) => buildPlaceSuggestion(index));

const answerWith =
  (suggestions: readonly PlaceSuggestion[]): Handler =>
  () =>
    jsonResponse({ suggestions });

function renderSearch(
  handler: Handler,
  isDisabled = false,
): { api: ApiStub; onChoose: Mock<(suggestion: PlaceSuggestion) => void> } {
  const api = stubApi({ [ROUTES.placesSearch]: handler });
  const onChoose = vi.fn<(suggestion: PlaceSuggestion) => void>();
  render(<AddressSearch isDisabled={isDisabled} onChoose={onChoose} />);
  return { api, onChoose };
}

const field = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("combobox", { name: t.label });
const options = (): HTMLElement[] => screen.queryAllByRole("option");
const status = (): HTMLElement => screen.getByRole("status", { name: t.label });
const searched = (api: ApiStub): (string | null)[] =>
  api.addresses(ROUTES.placesSearch).map((address) => address.searchParams.get("q"));

function type(text: string): void {
  fireEvent.change(field(), { target: { value: text } });
}

// Lets the timers and the answer of the stubbed request run.
async function wait(ms: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

async function searchFor(text: string): Promise<void> {
  type(text);
  await wait(400);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the address search", () => {
  it("is inactive while its map is not ready", () => {
    renderSearch(answerWith(FIVE), true);

    expect(field().getAttribute("aria-disabled")).toBe("true");
  });

  it("asks nothing for fewer than 3 characters after trimming", async () => {
    const { api } = renderSearch(answerWith(FIVE));

    type("  an  ");
    await wait(1_000);

    expect(searched(api)).toEqual([]);
    expect(options()).toHaveLength(0);
  });

  it("asks once, 400 ms after the last keystroke, and lists the suggestions", async () => {
    const { api } = renderSearch(answerWith(FIVE));

    type("ana");
    await wait(200);
    type("anal");
    await wait(399);
    expect(searched(api)).toEqual([]);
    await wait(1);

    expect(searched(api)).toEqual(["anal"]);
    expect(options().map((option) => option.textContent)).toEqual(FIVE.map((s) => s.label));
  });

  it("asks for 3 characters, trimmed", async () => {
    const { api } = renderSearch(answerWith(FIVE));

    await searchFor(" ana ");

    expect(searched(api)).toEqual(["ana"]);
  });

  it("shows that it is searching, without blocking the field", async () => {
    renderSearch(() => new Promise<Response>(() => undefined));

    await searchFor("analakely");

    expect(field().getAttribute("aria-busy")).toBe("true");
    expect(field().getAttribute("aria-disabled")).toBeNull();
    expect(screen.getByText(texts.common.loading)).toBeDefined();
  });

  it("hands the chosen suggestion over, closes the list and shows its label", async () => {
    const { api, onChoose } = renderSearch(answerWith(FIVE));
    const [, second] = FIVE;

    await searchFor("anal");
    fireEvent.click(screen.getByRole("option", { name: second?.label }));

    expect(onChoose.mock.calls).toEqual([[second]]);
    expect(options()).toHaveLength(0);
    expect(field().value).toBe(second?.label);
    // The label in the field is not searched again: the list stays closed.
    await wait(400);
    expect(searched(api)).toEqual(["anal"]);
    expect(options()).toHaveLength(0);
  });

  it("ignores an answer that comes after a newer keystroke", async () => {
    let answerFirst: (() => void) | undefined;
    let requestCount = 0;
    const { api } = renderSearch(() => {
      requestCount += 1;
      if (requestCount === 1) {
        // Answers late, whatever the cancellation: the screen must ignore it anyway.
        return new Promise<Response>((resolve) => {
          answerFirst = () => {
            resolve(jsonResponse({ suggestions: [buildPlaceSuggestion(9)] }));
          };
        });
      }
      return jsonResponse({ suggestions: [buildPlaceSuggestion(1)] });
    });

    await searchFor("anal");
    await searchFor("analakely");
    answerFirst?.();
    await wait(0);

    expect(searched(api)).toEqual(["anal", "analakely"]);
    expect(options().map((option) => option.textContent)).toEqual([buildPlaceSuggestion(1).label]);
  });

  it("searches a text typed again after a failure anew, instead of showing the old answer", async () => {
    let requestCount = 0;
    renderSearch(() => {
      requestCount += 1;
      return requestCount === 1 ? problemResponse(503) : new Promise<Response>(() => undefined);
    });

    await searchFor("analakely");
    expect(status().textContent).toBe(t.failed);
    fireEvent.keyDown(field(), { key: "Escape" });
    await wait(400);
    await searchFor("analakely");

    expect(field().getAttribute("aria-busy")).toBe("true");
    expect(status().textContent).toBe("");
  });

  it("says that no place was found", async () => {
    renderSearch(answerWith([]));

    await searchFor("zzzz");

    expect(status().textContent).toBe(t.noResult);
  });

  it.each([
    ["the service is unavailable", (): Response => problemResponse(503)],
    [
      "the answer is not valid",
      (): Response =>
        jsonResponse({
          suggestions: [1, 2, 3, 4, 5, 6].map((index) => buildPlaceSuggestion(index)),
        }),
    ],
    ["the network fails", networkFailure],
  ])("says the search is unavailable when %s", async (_name, answer) => {
    renderSearch(answer);

    await searchFor("analakely");

    expect(status().textContent).toBe(t.failed);
    expect(field().getAttribute("aria-disabled")).toBeNull();
  });

  it("chooses the first suggestion with the down arrow then Enter", async () => {
    const { onChoose } = renderSearch(answerWith(FIVE));
    const [first] = FIVE;

    await searchFor("anal");
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(field().getAttribute("aria-activedescendant")).toBe(options()[0]?.id);
    fireEvent.keyDown(field(), { key: "Enter" });

    expect(onChoose.mock.calls).toEqual([[first]]);
  });

  it("closes the list with Escape, which empties the field as the other searches do", async () => {
    renderSearch(answerWith(FIVE));

    await searchFor("anal");
    expect(field().getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(field(), { key: "Escape" });

    expect(options()).toHaveLength(0);
    expect(field().getAttribute("aria-expanded")).toBe("false");
    expect(field().value).toBe("");
  });

  it("empties the field and the list with the clear button", async () => {
    renderSearch(answerWith(FIVE));

    await searchFor("anal");
    fireEvent.click(screen.getByRole("button", { name: t.clear }));

    expect(field().value).toBe("");
    expect(options()).toHaveLength(0);
  });

  it("shows markup in a label as text", async () => {
    const label = '<img src="x" onerror="alert(1)"> Lieu Démo';
    renderSearch(answerWith([buildPlaceSuggestion(1, { label })]));

    await searchFor("anal");

    const listbox = screen.getByRole("listbox", { name: t.label });
    expect(within(listbox).getByRole("option").textContent).toBe(label);
    expect(listbox.querySelector("img")).toBeNull();
  });
});
