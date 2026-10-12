import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { buildProduct } from "../../../test-support/catalogue/build-product";
import { openCatalogue } from "../../../test-support/catalogue/catalogue-harness";
import {
  bodyOf,
  handleOf,
  list,
  namesInOrder,
} from "../../../test-support/catalogue/catalogue-queries";
import { problemResponse, ROUTES } from "../../../test-support/stubs/stub-api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const t = texts.catalogue;
const vanille = buildProduct(1, { name: "Vanille", sku: "VAN-01" });
const chocolat = buildProduct(2, { name: "Chocolat", sku: "CHO-01" });
const fraise = buildProduct(3, { name: "Fraise", sku: "FRA-01", available: false });

describe("the display order", () => {
  // jsdom has no layout: the rows are given a height by their place in the table, and the
  // observer that dnd-kit uses to measure them is a no-op.
  function giveRowsALayout(): void {
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
      const row = this.closest("tr");
      const index = row === null ? 0 : [...(row.parentElement?.children ?? [])].indexOf(row);
      const top = row === null ? 0 : index * 60;
      return new DOMRect(0, top, 800, 60);
    });
  }

  async function moveDown(name: string, position: number, total: number): Promise<void> {
    const handle = handleOf(name, position, total);
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document.activeElement ?? handle, { code: "ArrowDown", key: "ArrowDown" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document.activeElement ?? handle, { code: "Space", key: " " });
  }

  it("sends one request with the whole order after the moves stop", async () => {
    giveRowsALayout();
    const api = await openCatalogue({
      [ROUTES.products]: () => list(vanille, chocolat, fraise),
      [ROUTES.productOrder]: () => list(chocolat, vanille, fraise),
    });
    await screen.findByText("Vanille");

    await moveDown("Vanille", 1, 3);
    await waitFor(() => {
      expect(namesInOrder()).toEqual(["Chocolat", "Vanille", "Fraise"]);
    });
    expect(api.calls(ROUTES.productOrder)).toHaveLength(0);

    await waitFor(() => {
      expect(api.calls(ROUTES.productOrder)).toHaveLength(1);
    });
    expect(bodyOf(api.calls(ROUTES.productOrder)[0])).toEqual({
      ids: [chocolat.id, vanille.id, fraise.id],
    });
  });

  it("keeps the last order when the moves follow each other", async () => {
    giveRowsALayout();
    const api = await openCatalogue({
      [ROUTES.products]: () => list(vanille, chocolat, fraise),
      [ROUTES.productOrder]: () => list(chocolat, fraise, vanille),
    });
    await screen.findByText("Vanille");

    await moveDown("Vanille", 1, 3);
    await waitFor(() => {
      expect(namesInOrder()).toEqual(["Chocolat", "Vanille", "Fraise"]);
    });
    await moveDown("Vanille", 2, 3);
    await waitFor(() => {
      expect(namesInOrder()).toEqual(["Chocolat", "Fraise", "Vanille"]);
    });

    await waitFor(() => {
      expect(api.calls(ROUTES.productOrder)).toHaveLength(1);
    });
    expect(bodyOf(api.calls(ROUTES.productOrder)[0])).toEqual({
      ids: [chocolat.id, fraise.id, vanille.id],
    });
  });

  it("changes nothing when the drag is cancelled", async () => {
    giveRowsALayout();
    const api = await openCatalogue({ [ROUTES.products]: () => list(vanille, chocolat) });
    await screen.findByText("Vanille");

    const handle = handleOf("Vanille", 1, 2);
    handle.focus();
    fireEvent.keyDown(handle, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document.activeElement ?? handle, { code: "Escape", key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(namesInOrder()).toEqual(["Vanille", "Chocolat"]);
    expect(api.calls(ROUTES.productOrder)).toHaveLength(0);
  });

  it("reloads the list and says so when the order is refused", async () => {
    giveRowsALayout();
    let reads = 0;
    await openCatalogue({
      [ROUTES.products]: () => {
        reads += 1;
        return list(vanille, chocolat);
      },
      [ROUTES.productOrder]: () => problemResponse(409),
    });
    await screen.findByText("Vanille");

    await moveDown("Vanille", 1, 2);

    await screen.findByText(t.notices.orderFailed);
    await waitFor(() => {
      expect(reads).toBe(2);
    });
    expect(namesInOrder()).toEqual(["Vanille", "Chocolat"]);
  });

  it("disables the handles outside the Tous tab and during a search", async () => {
    await openCatalogue({ [ROUTES.products]: () => list(vanille, chocolat, fraise) });
    await screen.findByText("Vanille");
    expect(handleOf("Vanille", 1, 3).getAttribute("aria-disabled")).not.toBe("true");

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "a" } });
    expect(
      screen.getByRole("button", { name: /^Déplacer Vanille/ }).getAttribute("aria-disabled"),
    ).toBe("true");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: t.tabs.available }));

    expect(
      screen.getByRole("button", { name: /^Déplacer Vanille/ }).getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("sends the move at once when the screen is left before the delay", async () => {
    giveRowsALayout();
    const api = await openCatalogue({
      [ROUTES.products]: () => list(vanille, chocolat),
      [ROUTES.productOrder]: () => list(chocolat, vanille),
    });
    await screen.findByText("Vanille");

    await moveDown("Vanille", 1, 2);
    fireEvent.click(screen.getByRole("link", { name: texts.orders.title }));

    await waitFor(() => {
      expect(api.calls(ROUTES.productOrder)).toHaveLength(1);
    });
  });
});
