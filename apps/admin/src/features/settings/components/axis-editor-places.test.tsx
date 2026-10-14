import { MAX_PLACES_PER_AXIS } from "@entana/contracts";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { bodyOf } from "../../../test-support/catalogue/catalogue-queries";
import { buildAxis, buildAxisPlace, buildPlace } from "../../../test-support/settings/build-axis";
import {
  axesList,
  openAxisScreen,
  placesList,
} from "../../../test-support/settings/settings-harness";
import {
  axisRoute,
  jsonResponse,
  namedProblemResponse,
  problemResponse,
  ROUTES,
} from "../../../test-support/stubs/stub-api";
import type { AxisEditorMapOptions } from "../map/axis-editor-map-adapter";
import type { AxisDrawing } from "../rules/axis-editor-drawing";

// The map library is an external boundary that jsdom cannot run: the adapter is replaced, and
// the test reads what the screen gave it.
const mapLoader = vi.hoisted(() => ({ load: vi.fn(), setDrawing: vi.fn() }));
vi.mock("../map/axis-editor-map-adapter", () => ({ loadAxisEditorMap: mapLoader.load }));
vi.mock("../map/axes-map-adapter", () => ({
  loadAxesMap: () =>
    Promise.resolve({ setAxes: vi.fn(), setTestPoint: vi.fn(), destroy: () => undefined }),
}));

let mapOptions: AxisEditorMapOptions | undefined;

beforeEach(() => {
  mapOptions = undefined;
  mapLoader.setDrawing.mockReset();
  mapLoader.load.mockReset();
  mapLoader.load.mockImplementation((options: AxisEditorMapOptions) => {
    mapOptions = options;
    return Promise.resolve({ setDrawing: mapLoader.setDrawing, destroy: () => undefined });
  });
  // jsdom has no layout: the rows are given a height by their place in the list, and the
  // observer that dnd-kit uses to measure them is a no-op.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    const row = this.closest("li");
    const index = row === null ? 0 : [...(row.parentElement?.children ?? [])].indexOf(row);
    return new DOMRect(0, index * 60, 400, 60);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const t = texts.settings.axisEditor;

const gare = buildAxisPlace(1, { name: "Gare" });
const market = buildAxisPlace(2, { name: "Marché", alsoIn: [] });
const closed = buildAxisPlace(3, { name: "Usine", active: false });
const north = buildAxis(1, { name: "Axe Nord", color: "#2f6b5a", places: [gare, market] });
const east = buildAxis(2, { name: "Axe Est", color: "#9a4a2a", places: [market] });
const west = buildAxis(3, { name: "Axe Ouest", color: "#7a2e5a", places: [market] });
const PLACES = [
  buildPlace(1, { name: "Gare" }),
  buildPlace(2, { name: "Marché" }),
  buildPlace(4, { name: "Ambohibao" }),
  buildPlace(5, { name: "Ampefiloha" }),
];

const listOfPlaces = (): HTMLElement => screen.getByRole("list", { name: t.places.title });
const namesInOrder = (): string[] =>
  within(listOfPlaces())
    .getAllByRole("listitem")
    .map((row) => row.querySelector("span > span")?.firstChild?.textContent ?? "");
const searchBox = (): HTMLElement => screen.getByRole("combobox", { name: t.search.label });

function openAxis(axis = north): ReturnType<typeof openAxisScreen> {
  return openAxisScreen(`/parametres/axes/${axis.id}`, axis.name, {
    [ROUTES.axes]: () => axesList(axis, east, west),
    [ROUTES.places]: () => placesList(...PLACES),
    [axisRoute(axis.id, "PUT")]: () => jsonResponse(axis),
  });
}

async function loadedMap(): Promise<AxisEditorMapOptions> {
  await waitFor(() => {
    expect(mapOptions).toBeDefined();
  });
  if (mapOptions === undefined) {
    throw new Error("the map was not loaded");
  }
  return mapOptions;
}

/** Space picks the place up, the down arrow moves it one place, Space drops it. */
async function moveDown(name: string, position: number, total: number): Promise<void> {
  const handle = screen.getByRole("button", { name: t.places.handle(name, position, total) });
  handle.focus();
  for (const key of [" ", "ArrowDown", " "]) {
    fireEvent.keyDown(document.activeElement ?? handle, {
      code: key === " " ? "Space" : key,
      key,
    });
    // dnd-kit moves the row on the next turn of the event loop.
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  }
}

describe("the places of an axis", () => {
  it("numbers the places in order and says which other axes hold one", async () => {
    await openAxis();

    expect(namesInOrder()).toEqual(["Gare", "Marché"]);
    expect(
      within(listOfPlaces()).getByText(t.places.alsoIn(["Axe Est", "Axe Ouest"])),
    ).toBeDefined();
    expect(within(listOfPlaces()).getAllByText(/Aussi dans/)).toHaveLength(1);
  });

  it("marks a place the shop no longer offers as inactive, and lets it be removed", async () => {
    const withClosed = { ...north, places: [gare, closed] };
    const api = await openAxis(withClosed);

    const row = within(listOfPlaces()).getByText("Usine").closest("li");
    expect(row === null ? null : within(row).getByText(t.places.inactive)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.places.remove("Usine") }));
    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await waitFor(() => {
      expect(api.calls(axisRoute(north.id, "PUT")).map(bodyOf)).toMatchObject([
        { places: [{ placeId: gare.id }] },
      ]);
    });
  });

  it("finds a place outside the axis, adds it at the end, and the body follows the list", async () => {
    const api = await openAxis();

    fireEvent.change(searchBox(), { target: { value: "AMBÔ" } });
    expect(
      within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Ambohibao"]);
    fireEvent.keyDown(searchBox(), { key: "Enter" });
    fireEvent.change(searchBox(), { target: { value: "a" } });
    expect(screen.queryByRole("option", { name: "Gare" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.places.remove("Gare") }));
    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await waitFor(() => {
      expect(api.calls(axisRoute(north.id, "PUT")).map(bodyOf)).toMatchObject([
        { places: [{ placeId: market.id }, { placeId: PLACES[2]?.id }] },
      ]);
    });
  });

  it("moves through the results with the arrows, adds with Enter, and Escape clears", async () => {
    const api = await openAxis();

    fireEvent.change(searchBox(), { target: { value: "amp" } });
    fireEvent.keyDown(searchBox(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(searchBox(), { target: { value: "am" } });
    fireEvent.keyDown(searchBox(), { key: "ArrowDown" });
    fireEvent.keyDown(searchBox(), { key: "ArrowDown" });
    fireEvent.keyDown(searchBox(), { key: "ArrowUp" });
    expect(screen.getByRole("option", { selected: true }).textContent).toBe("Ampefiloha");
    fireEvent.mouseDown(screen.getByRole("option", { name: "Ampefiloha" }));
    fireEvent.keyDown(searchBox(), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await waitFor(() => {
      expect(api.calls(axisRoute(north.id, "PUT")).map(bodyOf)).toMatchObject([
        { places: [{ placeId: gare.id }, { placeId: market.id }, { placeId: PLACES[3]?.id }] },
      ]);
    });
  });

  it("says when no place has the name searched", async () => {
    await openAxis();

    fireEvent.change(searchBox(), { target: { value: "Zzz" } });

    expect(screen.getByText(t.search.noResult("Zzz"))).toBeDefined();
  });

  it("moves a place with the keyboard, and sends the new order", async () => {
    const api = await openAxis();

    await moveDown("Gare", 1, 2);
    expect(namesInOrder()).toEqual(["Marché", "Gare"]);
    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await waitFor(() => {
      expect(api.calls(axisRoute(north.id, "PUT")).map(bodyOf)).toMatchObject([
        { places: [{ placeId: market.id }, { placeId: gare.id }] },
      ]);
    });
  });

  it("moves a place with the pointer", async () => {
    await openAxis();
    const handle = screen.getByRole("button", { name: t.places.handle("Gare", 1, 2) });

    fireEvent.pointerDown(handle, { isPrimary: true, button: 0, clientX: 10, clientY: 30 });
    fireEvent.pointerMove(document, { isPrimary: true, clientX: 10, clientY: 50 });
    fireEvent.pointerMove(document, { isPrimary: true, clientX: 10, clientY: 95 });
    await act(() => Promise.resolve());
    fireEvent.pointerUp(document, { isPrimary: true, clientX: 10, clientY: 95 });
    await act(() => Promise.resolve());

    expect(namesInOrder()).toEqual(["Marché", "Gare"]);
  });

  it("stops the search once the axis holds the most places allowed", async () => {
    const places = Array.from({ length: MAX_PLACES_PER_AXIS }, (_, index) =>
      buildAxisPlace(10 + index),
    );
    await openAxis({ ...north, places });

    expect(searchBox()).toHaveProperty("disabled", true);
    expect(screen.getByText(t.search.full)).toBeDefined();
  });
});

describe("the map of the axis", () => {
  const drawnOf = (call: unknown): AxisDrawing => call as AxisDrawing;

  it("gets the axis in its colour, its places in order, and the other active places", async () => {
    await openAxis();

    const options = await loadedMap();

    expect(options.drawing).toEqual({
      color: "#2f6b5a",
      places: [gare, market].map((place) => ({
        name: place.name,
        lat: place.latitude,
        lng: place.longitude,
        radiusM: place.radiusM,
      })),
      others: PLACES.slice(2).map((place) => ({
        lat: place.latitude,
        lng: place.longitude,
        radiusM: place.radiusM,
      })),
    });
  });

  it("is drawn again when the colour or the order changes", async () => {
    await openAxis();
    await loadedMap();

    fireEvent.change(screen.getByLabelText(t.color), { target: { value: "#123456" } });
    await moveDown("Gare", 1, 2);

    const last = drawnOf(mapLoader.setDrawing.mock.calls.at(-1)?.[0]);
    expect(last.color).toBe("#123456");
    expect(last.places.map((place) => place.name)).toEqual(["Marché", "Gare"]);
  });
});

describe("the deletion of an axis", () => {
  async function askDeletion(answer: () => Response): Promise<ReturnType<typeof openAxis>> {
    const api = await openAxisScreen(`/parametres/axes/${north.id}`, "Axe Nord", {
      [ROUTES.axes]: () => axesList(north, east),
      [ROUTES.places]: () => placesList(...PLACES),
      [ROUTES.settings]: () => problemResponse(500),
      [axisRoute(north.id, "DELETE")]: answer,
    });
    fireEvent.click(screen.getByRole("button", { name: t.delete }));
    return api;
  }

  it("names the axis and says the places stay; « Garder l'axe » sends nothing", async () => {
    const api = await askDeletion(() => new Response(null, { status: 204 }));

    const dialog = screen.getByRole("dialog", { name: t.dialog.title("Axe Nord") });
    expect(within(dialog).getByText(t.dialog.body)).toBeDefined();
    fireEvent.click(within(dialog).getByRole("button", { name: t.dialog.cancel }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.calls(axisRoute(north.id, "DELETE"))).toHaveLength(0);
  });

  it("deletes the axis and goes back to the list", async () => {
    const api = await askDeletion(() => new Response(null, { status: 204 }));

    fireEvent.click(screen.getByRole("button", { name: t.dialog.confirm }));

    expect(await screen.findByRole("heading", { name: texts.settings.title })).toBeDefined();
    expect(api.calls(axisRoute(north.id, "DELETE"))).toHaveLength(1);
  });

  it("says that orders use the axis, closes the question and keeps the form", async () => {
    await askDeletion(() => namedProblemResponse(409, "delivery_axis_in_use"));

    fireEvent.click(screen.getByRole("button", { name: t.dialog.confirm }));

    expect(await screen.findByText(t.notices.inUse)).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Axe Nord" })).toBeDefined();
  });

  it("says when the deletion fails for another reason", async () => {
    await askDeletion(() => problemResponse(500));

    fireEvent.click(screen.getByRole("button", { name: t.dialog.confirm }));

    expect(await screen.findByText(t.notices.deleteFailed)).toBeDefined();
  });
});
