import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  addressField,
  chooseSuggestion,
} from "../../test-support/address-search/choose-suggestion";
import { buildPlaceSuggestion } from "../../test-support/builders/build-place-suggestion";
import { buildAxis, buildAxisPlace, buildPlace } from "../../test-support/settings/build-axis";
import { axesList, openAxisScreen, placesList } from "../../test-support/settings/settings-harness";
import { ROUTES } from "../../test-support/stubs/stub-api";
import type { AxisEditorMapOptions } from "./map/axis-editor-map-adapter";
import type { AxisDrawing } from "./rules/axis-editor-drawing";

// The map library is an external boundary that jsdom cannot run: the adapter is replaced.
const mapLoader = vi.hoisted(() => ({ load: vi.fn(), setDrawing: vi.fn(), centreOn: vi.fn() }));
vi.mock("./map/axis-editor-map-adapter", () => ({ loadAxisEditorMap: mapLoader.load }));

const t = texts.settings.axisEditor;
const SUGGESTION = buildPlaceSuggestion(1, { lat: -18.95, lng: 47.45 });
const north = buildAxis(1, { name: "Axe Nord", places: [buildAxisPlace(1, { name: "Gare" })] });

beforeEach(() => {
  mapLoader.setDrawing.mockReset();
  mapLoader.centreOn.mockReset();
  mapLoader.load.mockReset();
  mapLoader.load.mockImplementation((_options: AxisEditorMapOptions) =>
    Promise.resolve({
      setDrawing: mapLoader.setDrawing,
      centreOn: mapLoader.centreOn,
      destroy: () => undefined,
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const lastDrawing = (): AxisDrawing => mapLoader.setDrawing.mock.calls.at(-1)?.[0] as AxisDrawing;

const addressFields = (): HTMLElement[] =>
  screen.queryAllByRole("combobox", { name: texts.addressSearch.label });

describe("the address search of the axis editor", () => {
  it("is offered only while a click creates a place, and opens « Nouveau lieu » like a click", async () => {
    const api = await openAxisScreen(`/parametres/axes/${north.id}`, north.name, {
      [ROUTES.axes]: () => axesList(north),
      [ROUTES.places]: () => placesList(buildPlace(1, { name: "Gare" })),
    });
    expect(addressFields()).toHaveLength(0);

    fireEvent.click(await screen.findByRole("button", { name: t.drawing.create }));
    await waitFor(() => {
      expect(addressField().getAttribute("aria-disabled")).toBeNull();
    });
    // Escape empties the field only: « Créer un lieu » goes on, so the field stays.
    fireEvent.change(addressField(), { target: { value: "analakely" } });
    fireEvent.keyDown(addressField(), { key: "Escape" });
    expect(addressField().value).toBe("");
    await chooseSuggestion(api, SUGGESTION);

    expect(await screen.findByRole("dialog", { name: t.newPlace.title })).toBeDefined();
    expect(lastDrawing().pending).toEqual({ lat: -18.95, lng: 47.45, radiusM: 500 });
    expect(mapLoader.centreOn).toHaveBeenCalledWith({ lat: -18.95, lng: 47.45 }, 16);
  });
});
