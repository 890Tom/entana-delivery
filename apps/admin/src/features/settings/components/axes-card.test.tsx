import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { bodyOf } from "../../../test-support/catalogue/catalogue-queries";
import { buildAxis, buildAxisPlace } from "../../../test-support/settings/build-axis";
import { axesList, openAxesTab } from "../../../test-support/settings/settings-harness";
import {
  namedProblemResponse,
  pendingUntilAborted,
  problemResponse,
  ROUTES,
} from "../../../test-support/stubs/stub-api";

// The map library is an external boundary that jsdom cannot run: the screen gets a fake map.
vi.mock("../map/axes-map-adapter", () => ({
  loadAxesMap: () =>
    Promise.resolve({
      setAxes: () => undefined,
      setTestPoint: () => undefined,
      destroy: () => undefined,
    }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const t = texts.settings.axes;

const north = buildAxis(1, {
  name: "Axe Nord",
  color: "#2f6b5a",
  places: [1, 2, 3, 4, 5, 6, 7].map((index) =>
    buildAxisPlace(index, { name: `Lieu ${String(index)}` }),
  ),
});
const east = buildAxis(2, {
  name: "Axe Est",
  color: "#9a4a2a",
  places: [buildAxisPlace(8, { name: "Gare" })],
});
const south = buildAxis(3, { name: "Axe Sud", color: "#7a2e5a", active: false });

const listOfAxes = (): HTMLElement => screen.getByRole("list", { name: t.listLabel });
const rowOf = (name: string): HTMLElement => {
  const row = within(listOfAxes()).getByText(name).closest("li");
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};
const namesInOrder = (): string[] =>
  within(listOfAxes())
    .getAllByRole("listitem")
    .map((row) => row.querySelector("span > span")?.firstChild?.textContent ?? "");
// The browser reads a #rrggbb background back as rgb().
const NORTH_COLOUR = "rgb(47, 107, 90)";
const EAST_COLOUR = "rgb(154, 74, 42)";
const dotColourOf = (name: string): string =>
  rowOf(name).querySelector<HTMLElement>("span[aria-hidden='true']")?.style.backgroundColor ?? "";

describe("the list of the axes", () => {
  it("shows the axes in priority order, with their route and their number of places", async () => {
    await openAxesTab(() => axesList(north, east));

    await screen.findByText("Axe Nord");
    expect(namesInOrder()).toEqual(["Axe Nord", "Axe Est"]);
    expect(within(rowOf("Axe Nord")).getByText("Lieu 1 → Lieu 2 → … → Lieu 7")).toBeDefined();
    expect(within(rowOf("Axe Nord")).getByText("7 lieux")).toBeDefined();
    expect(within(rowOf("Axe Est")).getByText("1 lieu")).toBeDefined();
  });

  it("says that delivery is free inside an axis", async () => {
    await openAxesTab(() => axesList(north, east));

    expect(await screen.findByText(t.freeInside)).toBeDefined();
  });

  it("marks an inactive axis and keeps it in the list", async () => {
    await openAxesTab(() => axesList(north, south));

    await screen.findByText("Axe Sud");
    expect(within(rowOf("Axe Sud")).getByText(t.inactive)).toBeDefined();
    expect(within(rowOf("Axe Nord")).queryByText(t.inactive)).toBeNull();
  });

  it("offers no way to add an axis and no link on the rows", async () => {
    await openAxesTab(() => axesList(north, east));

    await screen.findByText("Axe Nord");
    expect(screen.queryByRole("button", { name: /ajouter un axe/i })).toBeNull();
    expect(within(listOfAxes()).queryAllByRole("link")).toEqual([]);
  });

  it("shows a skeleton while the axes load", async () => {
    await openAxesTab(pendingUntilAborted);

    const card = screen.getByRole("region", { name: t.title });
    expect(card.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(within(card).getByText(texts.common.loading)).toBeDefined();
  });

  it("offers to retry when the axes cannot be read, and shows them once read", async () => {
    let reads = 0;
    await openAxesTab(() => {
      reads += 1;
      return reads === 1 ? problemResponse(500) : axesList(north);
    });

    await screen.findByText(t.loadFailed);
    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    expect(await screen.findByText("Axe Nord")).toBeDefined();
  });

  it("says that there is no axis yet", async () => {
    await openAxesTab(() => axesList());

    expect(await screen.findByText(t.empty)).toBeDefined();
  });
});

describe("the priority of the axes", () => {
  // jsdom has no layout: the rows are given a height by their place in the list, and the
  // observer that dnd-kit uses to measure them is a no-op.
  beforeEach(() => {
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

  async function passTime(milliseconds: number): Promise<void> {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(milliseconds);
    });
  }

  /** Space picks the axis up, the down arrow moves it one place, Space drops it. */
  async function moveDown(name: string, position: number, total: number): Promise<void> {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const handle = screen.getByRole("button", { name: t.handle(name, position, total) });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await passTime(0);
    fireEvent.keyDown(document.activeElement ?? handle, { code: "ArrowDown", key: "ArrowDown" });
    await passTime(0);
    fireEvent.keyDown(document.activeElement ?? handle, { code: "Space", key: " " });
    await passTime(0);
  }

  it("sends every id in the new order once the axis is moved with the keyboard", async () => {
    const api = await openAxesTab(() => axesList(north, east, south), {
      [ROUTES.axesOrder]: () => axesList(east, north, south),
    });
    await screen.findByText("Axe Nord");

    await moveDown("Axe Nord", 1, 3);
    expect(namesInOrder()).toEqual(["Axe Est", "Axe Nord", "Axe Sud"]);
    await passTime(500);

    expect(api.calls(ROUTES.axesOrder).map(bodyOf)).toEqual([
      { ids: [east.id, north.id, south.id] },
    ]);
  });

  it("keeps the colour of each axis when it moves", async () => {
    await openAxesTab(() => axesList(north, east), {
      [ROUTES.axesOrder]: () => axesList(east, north),
    });
    await screen.findByText("Axe Nord");
    expect(dotColourOf("Axe Nord")).toBe(NORTH_COLOUR);

    await moveDown("Axe Nord", 1, 2);
    await passTime(500);

    expect(dotColourOf("Axe Nord")).toBe(NORTH_COLOUR);
    expect(dotColourOf("Axe Est")).toBe(EAST_COLOUR);
  });

  it("puts the previous order back and says so when the order is refused", async () => {
    await openAxesTab(() => axesList(north, east), {
      [ROUTES.axesOrder]: () => problemResponse(500),
    });
    await screen.findByText("Axe Nord");

    await moveDown("Axe Nord", 1, 2);
    await passTime(500);
    // The answer is read on the real clock and the query cache tells the screen on the fake one:
    // `vi.waitFor` moves the fake clock on while it waits.
    await vi.waitFor(() => {
      expect(namesInOrder()).toEqual(["Axe Nord", "Axe Est"]);
    });
    expect(screen.getByText(t.orderFailed)).toBeDefined();
  });

  it("reads the list again and says so when it changed on the server", async () => {
    const api = await openAxesTab(() => axesList(north, east), {
      [ROUTES.axesOrder]: () => namedProblemResponse(422, "delivery_axis_order_mismatch"),
    });
    await screen.findByText("Axe Nord");

    await moveDown("Axe Nord", 1, 2);
    await passTime(500);
    vi.useRealTimers();

    expect(await screen.findByText(t.orderChanged)).toBeDefined();
    await waitFor(() => {
      expect(api.calls(ROUTES.axes)).toHaveLength(2);
    });
  });

  it("sends nothing when the axis is dropped where it was", async () => {
    const api = await openAxesTab(() => axesList(north, east));
    await screen.findByText("Axe Nord");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const handle = screen.getByRole("button", { name: t.handle("Axe Nord", 1, 2) });
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await passTime(0);
    fireEvent.keyDown(document.activeElement ?? handle, { code: "Space", key: " " });
    await passTime(600);

    expect(namesInOrder()).toEqual(["Axe Nord", "Axe Est"]);
    expect(api.calls(ROUTES.axesOrder)).toHaveLength(0);
  });

  it("still sends the move when the tab is left within the delay", async () => {
    const api = await openAxesTab(() => axesList(north, east), {
      [ROUTES.axesOrder]: () => axesList(east, north),
    });
    await screen.findByText("Axe Nord");

    await moveDown("Axe Nord", 1, 2);
    fireEvent.click(screen.getByRole("link", { name: texts.settings.tabs.texts }));

    expect(api.calls(ROUTES.axesOrder).map(bodyOf)).toEqual([{ ids: [east.id, north.id] }]);
  });

  it("reads the list again when the session is refused", async () => {
    const api = await openAxesTab(() => axesList(north, east), {
      [ROUTES.axesOrder]: () => problemResponse(401),
    });
    await screen.findByText("Axe Nord");

    await moveDown("Axe Nord", 1, 2);
    await passTime(500);

    await vi.waitFor(() => {
      expect(api.calls(ROUTES.axes)).toHaveLength(2);
    });
    expect(screen.queryByText(t.orderFailed)).toBeNull();
  });
});
