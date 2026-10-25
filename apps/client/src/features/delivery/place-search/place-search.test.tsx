import type { PlaceSuggestion } from "@entana/contracts";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { texts } from "../../../i18n/texts";
import { buildPlaceSuggestion } from "../../../test-support/builders/build-place-suggestion";
import { createFakeMapLoader } from "../../../test-support/stubs/fake-map";
import type { FakeMap, FakeMapLoader } from "../../../test-support/stubs/fake-map";
import { jsonResponse, problemResponse } from "../../../test-support/stubs/stub-fetch";
import type { GeoPoint } from "../map/map-adapter";
import { MAP_LOADER_CONTEXT } from "../map/map-loader-context";
import { PointPicker } from "../point-picker/point-picker";

const CONFIG = {
  styleUrl: "https://style.example/custom",
  center: { lat: -18.8, lng: 47.4 },
  zoom: 13,
};
const SEARCH_PATH = "/api/v1/places/search";
const FIVE = [1, 2, 3, 4, 5].map((index) => buildPlaceSuggestion(index));

type FetchStub = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

// The network boundary, the only thing stubbed: every request is a place search here.
function stubSearch(answer: (init: RequestInit | undefined) => Promise<Response>): FetchStub {
  const stub: FetchStub = vi.fn((_input, init) => answer(init));
  vi.stubGlobal("fetch", stub);
  return stub;
}

function answerWith(suggestions: readonly PlaceSuggestion[]): () => Promise<Response> {
  return () => Promise.resolve(jsonResponse({ suggestions }));
}

function searchedTexts(stub: FetchStub): (string | null)[] {
  return stub.mock.calls.map(([input]) => {
    const address = input instanceof Request ? input.url : input;
    const url = new URL(address, "https://shop.example");
    expect(url.pathname).toBe(SEARCH_PATH);
    return url.searchParams.get("q");
  });
}

interface Picker {
  readonly fake: FakeMapLoader;
  readonly onPick: Mock<(point: GeoPoint) => void>;
}

function renderPicker(): Picker {
  const fake = createFakeMapLoader();
  const onPick = vi.fn<(point: GeoPoint) => void>();
  render(
    <MAP_LOADER_CONTEXT value={fake.loader}>
      <PointPicker
        config={CONFIG}
        isConfigFailed={false}
        onRetryConfig={() => undefined}
        point={null}
        centreOn={null}
        onPick={onPick}
        zones={[]}
      >
        <span />
      </PointPicker>
    </MAP_LOADER_CONTEXT>,
  );
  return { fake, onPick };
}

/** The map is ready, then the clock is the test's: every wait below is simulated. */
async function readyPicker(): Promise<Picker & { readonly map: FakeMap }> {
  const picker = renderPicker();
  const map = await act(() => picker.fake.succeed());
  vi.useFakeTimers();
  return { ...picker, map };
}

const searchField = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("combobox", { name: texts.delivery.search.label });
const options = (): HTMLElement[] => screen.queryAllByRole("option");

function type(text: string): void {
  fireEvent.change(searchField(), { target: { value: text } });
}

// Lets the timers and the answer of the stubbed request run.
async function wait(ms: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

async function searchFor(text: string): Promise<void> {
  type(text);
  await wait(400);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the place search of the point picker", () => {
  it("is inactive while the map is not ready", () => {
    stubSearch(answerWith(FIVE));
    renderPicker();

    expect(searchField().getAttribute("aria-disabled")).toBe("true");
  });

  it("asks nothing for fewer than 3 characters after trimming", async () => {
    const stub = stubSearch(answerWith(FIVE));
    await readyPicker();

    type("  an  ");
    await wait(1_000);

    expect(stub).not.toHaveBeenCalled();
    expect(options()).toHaveLength(0);
  });

  it("asks once, 400 ms after the last keystroke, and lists at most 5 suggestions", async () => {
    const stub = stubSearch(answerWith(FIVE));
    await readyPicker();

    type("ana");
    await wait(200);
    type("anal");
    await wait(399);
    expect(stub).not.toHaveBeenCalled();
    await wait(1);

    expect(searchedTexts(stub)).toEqual(["anal"]);
    expect(options().map((option) => option.textContent)).toEqual(FIVE.map((s) => s.label));
  });

  it("shows that it is searching, without blocking the field", async () => {
    stubSearch(() => new Promise<Response>(() => undefined));
    await readyPicker();

    await searchFor("analakely");

    expect(searchField().getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText(texts.common.loading)).toBeDefined();
  });

  it("places the point through the handler of a tap, centres the map and shows the label", async () => {
    stubSearch(answerWith(FIVE));
    const { map, onPick } = await readyPicker();
    const [, second] = FIVE;
    const tapped = { lat: -18.7, lng: 47.3 };

    await searchFor("anal");
    fireEvent.click(screen.getByRole("option", { name: second?.label }));
    map.pick(tapped);

    expect(onPick.mock.calls).toEqual([[{ lat: second?.lat, lng: second?.lng }], [tapped]]);
    expect(map.centrings).toEqual([{ point: { lat: second?.lat, lng: second?.lng }, zoom: 16 }]);
    expect(options()).toHaveLength(0);
    expect(searchField().value).toBe(second?.label);
  });

  it("ignores an answer that comes after a newer keystroke", async () => {
    let answerFirst: (() => void) | undefined;
    let requestCount = 0;
    stubSearch(() => {
      requestCount += 1;
      if (requestCount === 1) {
        // Answers late, whatever the cancellation: the screen must ignore it anyway.
        return new Promise<Response>((resolve) => {
          answerFirst = () => {
            resolve(jsonResponse({ suggestions: [buildPlaceSuggestion(9)] }));
          };
        });
      }
      return Promise.resolve(jsonResponse({ suggestions: [buildPlaceSuggestion(1)] }));
    });
    await readyPicker();

    await searchFor("anal");
    await searchFor("analakely");
    answerFirst?.();
    await wait(0);

    expect(options().map((option) => option.textContent)).toEqual([buildPlaceSuggestion(1).label]);
  });

  it("searches a text typed again after a failure anew, instead of showing the old answer", async () => {
    let requestCount = 0;
    stubSearch(() => {
      requestCount += 1;
      return requestCount === 1
        ? Promise.resolve(problemResponse(503))
        : new Promise<Response>(() => undefined);
    });
    await readyPicker();

    await searchFor("analakely");
    expect(screen.getByRole("status", { name: texts.delivery.search.label }).textContent).toBe(
      texts.delivery.search.failed,
    );
    await searchFor("");
    await searchFor("analakely");

    expect(searchField().getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status", { name: texts.delivery.search.label }).textContent).toBe("");
  });

  it("says that no place was found", async () => {
    stubSearch(answerWith([]));
    await readyPicker();

    await searchFor("zzzz");

    expect(screen.getByRole("status", { name: texts.delivery.search.label }).textContent).toBe(
      texts.delivery.search.noResult,
    );
  });

  it.each([
    ["the service is unavailable", (): Promise<Response> => Promise.resolve(problemResponse(503))],
    [
      "the network fails",
      (): Promise<Response> => Promise.reject(new TypeError("Failed to fetch")),
    ],
  ])(
    "says the search is unavailable when %s, and the point stays placeable",
    async (_name, answer) => {
      stubSearch(answer);
      const { map, onPick } = await readyPicker();

      await searchFor("analakely");
      map.pick({ lat: -18.7, lng: 47.3 });

      expect(screen.getByRole("status", { name: texts.delivery.search.label }).textContent).toBe(
        texts.delivery.search.failed,
      );
      expect(onPick).toHaveBeenCalledWith({ lat: -18.7, lng: 47.3 });
    },
  );

  it("chooses the first suggestion with the down arrow then Enter", async () => {
    stubSearch(answerWith(FIVE));
    const { onPick } = await readyPicker();
    const [first] = FIVE;

    await searchFor("anal");
    fireEvent.keyDown(searchField(), { key: "ArrowDown" });
    expect(searchField().getAttribute("aria-activedescendant")).toBe(options()[0]?.id);
    fireEvent.keyDown(searchField(), { key: "Enter" });

    expect(onPick).toHaveBeenCalledWith({ lat: first?.lat, lng: first?.lng });
    expect(searchField().value).toBe(first?.label);
  });

  it("closes the list with Escape", async () => {
    stubSearch(answerWith(FIVE));
    await readyPicker();

    await searchFor("anal");
    expect(searchField().getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(searchField(), { key: "Escape" });

    expect(options()).toHaveLength(0);
    expect(searchField().getAttribute("aria-expanded")).toBe("false");
  });

  it("empties the field and the list with the clear button", async () => {
    stubSearch(answerWith(FIVE));
    await readyPicker();

    await searchFor("anal");
    fireEvent.click(screen.getByRole("button", { name: texts.delivery.search.clear }));

    expect(searchField().value).toBe("");
    expect(options()).toHaveLength(0);
  });

  it("shows markup in a label as text", async () => {
    const label = '<img src="x" onerror="alert(1)"> Lieu Démo';
    stubSearch(answerWith([buildPlaceSuggestion(1, { label })]));
    await readyPicker();

    await searchFor("anal");

    const listbox = screen.getByRole("listbox", { name: texts.delivery.search.results });
    expect(within(listbox).getByRole("option").textContent).toBe(label);
    expect(listbox.querySelector("img")).toBeNull();
  });
});
