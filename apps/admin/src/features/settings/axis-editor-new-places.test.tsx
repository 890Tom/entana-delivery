import { MAX_PLACES_PER_AXIS } from "@entana/contracts";
import type { GeoPoint } from "@entana/contracts";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { bodyOf } from "../../test-support/catalogue/catalogue-queries";
import { buildAxis, buildAxisPlace, buildPlace } from "../../test-support/settings/build-axis";
import { axesList, openAxisScreen, placesList } from "../../test-support/settings/settings-harness";
import {
  axisRoute,
  jsonResponse,
  namedProblemResponse,
  ROUTES,
} from "../../test-support/stubs/stub-api";
import type { AxisEditorMapOptions } from "./map/axis-editor-map-adapter";
import type { AxisDrawing } from "./rules/axis-editor-drawing";

// The map library is an external boundary that jsdom cannot run: the adapter is replaced, the
// test clicks through the handler the screen gave it and reads what the screen drew.
const mapLoader = vi.hoisted(() => ({ load: vi.fn(), setDrawing: vi.fn() }));
vi.mock("./map/axis-editor-map-adapter", () => ({ loadAxisEditorMap: mapLoader.load }));

let mapOptions: AxisEditorMapOptions | undefined;

beforeEach(() => {
  mapOptions = undefined;
  mapLoader.setDrawing.mockReset();
  mapLoader.load.mockReset();
  mapLoader.load.mockImplementation((options: AxisEditorMapOptions) => {
    mapOptions = options;
    return Promise.resolve({ setDrawing: mapLoader.setDrawing, destroy: () => undefined });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = texts.settings.axisEditor;
const POINT = { lat: -18.95, lng: 47.45 };
const OTHER_POINT = { lat: -18.96, lng: 47.46 };

const gare = buildAxisPlace(1, { name: "Gare" });
const market = buildAxisPlace(2, { name: "Marché" });
const north = buildAxis(1, { name: "Axe Nord", places: [gare, market] });

function openAxis(
  axis = north,
  answer: () => Response = () => jsonResponse(axis),
): ReturnType<typeof openAxisScreen> {
  return openAxisScreen(`/parametres/axes/${axis.id}`, axis.name, {
    [ROUTES.axes]: () => axesList(axis),
    [ROUTES.places]: () => placesList(buildPlace(1, { name: "Gare" })),
    [axisRoute(axis.id, "PUT")]: answer,
  });
}

async function clickMap(point: GeoPoint): Promise<void> {
  await waitFor(() => {
    expect(mapOptions).toBeDefined();
  });
  act(() => {
    mapOptions?.onPick(point);
  });
}

const createButton = (): HTMLElement => screen.getByRole("button", { name: t.drawing.create });
const traceButton = (): HTMLElement => screen.getByRole("button", { name: t.drawing.trace });
const nameField = (): HTMLElement => screen.getByRole("textbox", { name: t.newPlace.name });
const radiusField = (): HTMLElement =>
  screen.getByRole("spinbutton", { name: t.newPlace.radiusField });
const saveButton = (): HTMLElement => screen.getByRole("button", { name: t.save });
const namesInOrder = (): string[] =>
  within(screen.getByRole("list", { name: t.places.title }))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("span > span")?.firstChild?.textContent ?? "");
const lastDrawing = (): AxisDrawing => mapLoader.setDrawing.mock.calls.at(-1)?.[0] as AxisDrawing;

/** « Créer un lieu », a click on the map, then the name and the radius. */
async function createPlace(name: string, radiusText = "500"): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: t.drawing.create }));
  await clickMap(POINT);
  fireEvent.change(nameField(), { target: { value: name } });
  fireEvent.change(radiusField(), { target: { value: radiusText } });
  fireEvent.click(screen.getByRole("button", { name: t.newPlace.add }));
}

describe("« Créer un lieu »", () => {
  it("opens the window at 500 m on a click of the map, with the point drawn", async () => {
    await openAxis();

    fireEvent.click(await screen.findByRole("button", { name: t.drawing.create }));
    await clickMap(POINT);

    expect(screen.getByRole("dialog", { name: t.newPlace.title })).toBeDefined();
    expect(radiusField()).toHaveProperty("value", "500");
    expect(screen.getByRole("slider", { name: t.newPlace.radius(500) })).toBeDefined();
    expect(lastDrawing().pending).toEqual({ ...POINT, radiusM: 500 });
    expect(screen.getByText(t.places.draft)).toBeDefined();
  });

  it("adds the place at the end of the list, numbered on the map with its circle", async () => {
    await openAxis();

    await createPlace("Ivandry", "800");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(namesInOrder()).toEqual(["Gare", "Marché", "Ivandry"]);
    expect(lastDrawing().places.at(-1)).toEqual({ name: "Ivandry", ...POINT, radiusM: 800 });
    expect(createButton().getAttribute("aria-pressed")).toBe("false");
  });

  it.each([
    ["an empty name", "  ", t.newPlace.nameEmpty],
    ["a name over 60 characters", "x".repeat(61), t.newPlace.nameTooLong],
    ["a name already taken, in another case", "GARE", t.newPlace.nameTaken],
  ])("refuses %s with its message", async (_label, name, message) => {
    await openAxis();

    await createPlace(name);

    expect(screen.getByText(message)).toBeDefined();
    expect(nameField().getAttribute("aria-invalid")).toBe("true");
    expect(lastDrawing().places.map((place) => place.name)).toEqual(["Gare", "Marché"]);
  });

  it.each(["99", "3001"])("refuses a radius of %s m", async (radiusText) => {
    await openAxis();

    await createPlace("Ivandry", radiusText);

    expect(screen.getByText(t.newPlace.radiusOutOfRange)).toBeDefined();
    expect(radiusField().getAttribute("aria-invalid")).toBe("true");
  });

  it("is blocked, with its message, once the axis holds the most places allowed", async () => {
    const places = Array.from({ length: MAX_PLACES_PER_AXIS }, (_, index) =>
      buildAxisPlace(10 + index),
    );
    await openAxis({ ...north, places });

    fireEvent.click(await screen.findByRole("button", { name: t.drawing.create }));
    await clickMap(POINT);

    const reasonId = createButton().getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(reasonId)?.textContent).toBe(t.search.full);
    expect(traceButton().getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the window and forgets the point with Escape", async () => {
    await openAxis();

    fireEvent.click(await screen.findByRole("button", { name: t.drawing.create }));
    await clickMap(POINT);
    fireEvent.keyDown(nameField(), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(namesInOrder()).toEqual(["Gare", "Marché"]);
    expect(lastDrawing().pending).toBeNull();
  });
});

describe("the trace of the axis", () => {
  async function trace(name: string, point: GeoPoint): Promise<void> {
    await clickMap(point);
    fireEvent.change(nameField(), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: t.newPlace.add }));
  }

  it("adds a place per click in order, undoes the last, and « Terminer » ends it", async () => {
    await openAxis();
    fireEvent.click(await screen.findByRole("button", { name: t.drawing.trace }));

    await trace("Ivandry", POINT);
    await trace("Ankadifotsy", OTHER_POINT);
    expect(namesInOrder()).toEqual(["Gare", "Marché", "Ivandry", "Ankadifotsy"]);
    fireEvent.click(screen.getByRole("button", { name: t.drawing.undo }));
    expect(namesInOrder()).toEqual(["Gare", "Marché", "Ivandry"]);
    fireEvent.click(screen.getByRole("button", { name: t.drawing.finish }));

    expect(traceButton().getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("button", { name: t.drawing.undo })).toBeNull();
    await clickMap(OTHER_POINT);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("undoes the open point first, and greys the undo when nothing is left", async () => {
    await openAxis();
    fireEvent.click(await screen.findByRole("button", { name: t.drawing.trace }));
    const undo = screen.getByRole("button", { name: t.drawing.undo });
    expect(undo.getAttribute("aria-disabled")).toBe("true");

    await clickMap(POINT);
    fireEvent.click(undo);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(namesInOrder()).toEqual(["Gare", "Marché"]);
  });
});

describe("the save of the new places", () => {
  it("sends a new place with the axis only, and not while its window is open", async () => {
    const api = await openAxis();

    await createPlace("Ivandry", "800");
    expect(api.calls(axisRoute(north.id, "PUT"))).toHaveLength(0);
    fireEvent.click(createButton());
    await clickMap(OTHER_POINT);
    expect(saveButton().getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(nameField(), { key: "Escape" });
    fireEvent.click(saveButton());

    await waitFor(() => {
      expect(api.calls(axisRoute(north.id, "PUT")).map(bodyOf)).toMatchObject([
        {
          places: [
            { placeId: gare.id },
            { placeId: market.id },
            { name: "Ivandry", ...{ latitude: POINT.lat, longitude: POINT.lng }, radiusM: 800 },
          ],
        },
      ]);
    });
  });

  it("says under the list that a new name is taken, until the list changes", async () => {
    await openAxis(north, () => namedProblemResponse(409, "delivery_place_name_taken"));

    await createPlace("Ivandry");
    fireEvent.click(saveButton());

    expect((await screen.findByRole("alert")).textContent).toBe(t.places.newNameTaken);
    fireEvent.click(screen.getByRole("button", { name: t.places.remove("Ivandry") }));
    expect(screen.queryByText(t.places.newNameTaken)).toBeNull();
  });
});
