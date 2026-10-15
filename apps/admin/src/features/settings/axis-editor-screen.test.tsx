import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import { renderSignedIn } from "../../test-support/catalogue/catalogue-harness";
import { bodyOf } from "../../test-support/catalogue/catalogue-queries";
import { buildAxis, buildAxisPlace, buildPlace } from "../../test-support/settings/build-axis";
import {
  axesList,
  openAxesTab,
  openAxisScreen,
  placesList,
} from "../../test-support/settings/settings-harness";
import {
  axisRoute,
  jsonResponse,
  namedProblemResponse,
  pendingUntilAborted,
  problemResponse,
  ROUTES,
} from "../../test-support/stubs/stub-api";
import { AXIS_START_PALETTE } from "./rules/axis-palette";

// The map library is an external boundary that jsdom cannot run: both maps get a fake one.
const fakeMap = vi.hoisted(() => ({
  load: () =>
    Promise.resolve({
      setAxes: () => undefined,
      setTestPoint: () => undefined,
      setDrawing: () => undefined,
      destroy: () => undefined,
    }),
}));
vi.mock("./map/axes-map-adapter", () => ({ loadAxesMap: fakeMap.load }));
vi.mock("./map/axis-editor-map-adapter", () => ({ loadAxisEditorMap: fakeMap.load }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = texts.settings.axisEditor;

const north = buildAxis(1, {
  name: "Axe Nord",
  color: AXIS_START_PALETTE[0],
  places: [buildAxisPlace(1, { name: "Gare" }), buildAxisPlace(2, { name: "Marché" })],
});
const east = buildAxis(2, { name: "Axe Est", color: "#9a4a2a" });
const PLACES = [buildPlace(1, { name: "Gare" }), buildPlace(2, { name: "Marché" })];

const editPath = (axisId: string): string => `/parametres/axes/${axisId}`;
const saveButton = (): HTMLElement => screen.getByRole("button", { name: t.save });
const nameField = (): HTMLElement => screen.getByRole("textbox", { name: t.name });

function openNorth(
  handlers: Parameters<typeof openAxisScreen>[2] = {},
): ReturnType<typeof openAxisScreen> {
  return openAxisScreen(editPath(north.id), "Axe Nord", {
    [ROUTES.axes]: () => axesList(north, east),
    [ROUTES.places]: () => placesList(...PLACES),
    ...handlers,
  });
}

function openNew(
  handlers: Parameters<typeof openAxisScreen>[2] = {},
): ReturnType<typeof openAxisScreen> {
  return openAxisScreen("/parametres/axes/nouveau", t.newTitle, {
    [ROUTES.axes]: () => axesList(north),
    [ROUTES.places]: () => placesList(...PLACES),
    ...handlers,
  });
}

function addBySearch(search: string, name: string): void {
  fireEvent.change(screen.getByRole("combobox", { name: t.search.label }), {
    target: { value: search },
  });
  fireEvent.click(screen.getByRole("option", { name }));
}

describe("the way to the screen of an axis", () => {
  it("opens the creation from « Ajouter un axe »", async () => {
    await openAxesTab(() => axesList(north), { [ROUTES.places]: () => placesList(...PLACES) });

    fireEvent.click(screen.getByRole("link", { name: texts.settings.axes.add }));

    expect(await screen.findByRole("heading", { name: t.newTitle })).toBeDefined();
  });

  it("opens an axis from its row, and the tab « Paramètres » stays the current one", async () => {
    await openAxesTab(() => axesList(north, east), {
      [ROUTES.places]: () => placesList(...PLACES),
    });

    fireEvent.click(await screen.findByRole("link", { name: texts.settings.axes.edit("Axe Est") }));

    expect(await screen.findByRole("heading", { name: "Axe Est" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: texts.settings.title }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("says the page does not exist for an axis that is not in the list", async () => {
    await openAxisScreen(editPath("0199f5b0-0000-7000-8000-000000000000"), texts.notFound.title, {
      [ROUTES.axes]: () => axesList(north),
      [ROUTES.places]: () => placesList(...PLACES),
    });

    expect(screen.queryByRole("textbox", { name: t.name })).toBeNull();
  });

  it("shows a skeleton while the axes and the places load", async () => {
    renderSignedIn(editPath(north.id), {
      [ROUTES.axes]: pendingUntilAborted,
      [ROUTES.places]: () => placesList(...PLACES),
    });

    const busy = await screen.findByText(texts.common.loading);
    expect(busy.closest("[aria-busy='true']")).not.toBeNull();
  });

  it("offers to read again when the places cannot be read, then shows the axis", async () => {
    let reads = 0;
    renderSignedIn(editPath(north.id), {
      [ROUTES.axes]: () => axesList(north),
      [ROUTES.places]: () => {
        reads += 1;
        return reads === 1 ? problemResponse(500) : placesList(...PLACES);
      },
    });

    expect(await screen.findByText(t.loadFailed)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    expect(await screen.findByRole("heading", { name: "Axe Nord" })).toBeDefined();
  });
});

describe("the creation of an axis", () => {
  it("starts with the first colour of the palette that no axis uses", async () => {
    await openNew();

    expect(screen.getByLabelText(t.color)).toHaveProperty("value", AXIS_START_PALETTE[1]);
    expect(screen.getByText(AXIS_START_PALETTE[1])).toBeDefined();
  });

  it("sends the name, the colour, the state and the places in the chosen order, then goes back", async () => {
    const api = await openNew({ [ROUTES.createAxis]: () => jsonResponse(north, 201) });

    fireEvent.change(nameField(), { target: { value: "  Axe Sud " } });
    fireEvent.change(screen.getByLabelText(t.color), { target: { value: "#123456" } });
    addBySearch("mar", "Marché");
    addBySearch("gar", "Gare");
    fireEvent.click(saveButton());

    expect(await screen.findByRole("heading", { name: texts.settings.title })).toBeDefined();
    expect(api.calls(ROUTES.createAxis).map(bodyOf)).toEqual([
      {
        name: "Axe Sud",
        color: "#123456",
        active: true,
        places: [{ placeId: PLACES[1]?.id }, { placeId: PLACES[0]?.id }],
      },
    ]);
  });

  it("greys « Enregistrer » and says why while the axis has no name and no place", async () => {
    const api = await openNew();

    fireEvent.click(saveButton());

    expect(saveButton().getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(`${t.nameEmpty} ${t.places.none}`)).toBeDefined();
    expect(api.calls(ROUTES.createAxis)).toHaveLength(0);
  });
});

describe("the change of an axis", () => {
  it("greys « Enregistrer » and sends nothing while nothing has changed", async () => {
    const api = await openNorth();

    fireEvent.click(saveButton());
    // Enter in the name sends the form too.
    fireEvent.submit(nameField());

    expect(saveButton().getAttribute("aria-disabled")).toBe("true");
    expect(api.calls(axisRoute(north.id, "PUT"))).toHaveLength(0);
  });

  it("sends the whole axis once a field has changed, then goes back to the list", async () => {
    const api = await openNorth({ [axisRoute(north.id, "PUT")]: () => jsonResponse(north) });

    fireEvent.click(screen.getByRole("switch", { name: t.active }));
    fireEvent.click(saveButton());

    expect(await screen.findByRole("heading", { name: texts.settings.title })).toBeDefined();
    expect(api.calls(axisRoute(north.id, "PUT")).map(bodyOf)).toEqual([
      {
        name: "Axe Nord",
        color: north.color,
        active: false,
        places: north.places.map((place) => ({ placeId: place.id })),
      },
    ]);
  });

  it("refuses an axis without a place, with its message, and sends nothing", async () => {
    const api = await openNorth();

    for (const name of ["Gare", "Marché"]) {
      fireEvent.click(screen.getByRole("button", { name: t.places.remove(name) }));
    }
    fireEvent.click(saveButton());

    expect(screen.getByRole("alert").textContent).toBe(t.places.none);
    expect(api.calls(axisRoute(north.id, "PUT"))).toHaveLength(0);
  });

  it("refuses an empty name, with its message under the field, and sends nothing", async () => {
    const api = await openNorth();

    fireEvent.change(nameField(), { target: { value: "   " } });
    fireEvent.click(saveButton());

    expect(nameField().getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(t.nameEmpty)).toBeDefined();
    expect(api.calls(axisRoute(north.id, "PUT"))).toHaveLength(0);
  });
});

describe("a refused save", () => {
  async function saveRenamed(answer: () => Response): Promise<ReturnType<typeof openNorth>> {
    const api = openNorth({ [axisRoute(north.id, "PUT")]: answer });
    await api;
    fireEvent.change(nameField(), { target: { value: "Axe Est" } });
    fireEvent.click(saveButton());
    return api;
  }

  it("says under the name that another axis has it", async () => {
    await saveRenamed(() => namedProblemResponse(409, "delivery_axis_name_taken"));

    expect(await screen.findByText(t.nameTaken)).toBeDefined();
    expect(nameField().getAttribute("aria-invalid")).toBe("true");
  });

  it("says that a place is no longer offered, and reads the places again", async () => {
    const api = await saveRenamed(() => namedProblemResponse(422, "delivery_place_unavailable"));

    expect(await screen.findByText(t.notices.placeUnavailable)).toBeDefined();
    await waitFor(() => {
      expect(api.calls(ROUTES.places)).toHaveLength(2);
    });
  });

  it.each([
    [400, texts.settings.notices.invalid],
    [429, texts.settings.notices.rateLimited],
    [500, texts.settings.notices.failed],
  ])("says so in its own words after a %i, never in the server's", async (status, text) => {
    await saveRenamed(() => problemResponse(status));

    expect(await screen.findByText(text)).toBeDefined();
    expect(screen.queryByText(/SECRET/)).toBeNull();
    expect(screen.getByRole("heading", { name: "Axe Nord" })).toBeDefined();
  });
});

describe("a save refused for the session", () => {
  it("reads the axes again, which leads to the sign-in", async () => {
    const api = await openNorth({ [axisRoute(north.id, "PUT")]: () => problemResponse(401) });

    fireEvent.click(screen.getByRole("switch", { name: t.active }));
    fireEvent.click(saveButton());

    await waitFor(() => {
      expect(api.calls(ROUTES.axes).length).toBeGreaterThan(1);
    });
    expect(screen.queryByText(texts.settings.notices.failed)).toBeNull();
  });
});

describe("the page of an axis", () => {
  it("has no accessibility violation", async () => {
    await openNorth();

    await expectNoAccessibilityViolations(document.body);
    expect(within(document.body).getByRole("heading", { level: 1 })).toBeDefined();
  });
});
