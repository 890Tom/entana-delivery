import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { buildProduct } from "../../../test-support/catalogue/build-product";
import { openCatalogue } from "../../../test-support/catalogue/catalogue-harness";
import { bodyOf, list, rowOf } from "../../../test-support/catalogue/catalogue-queries";
import { expectNoAccessibilityViolations } from "../../../test-support/assertions/expect-no-accessibility-violations";
import {
  jsonResponse,
  networkFailure,
  problemResponse,
  productRoute,
  ROUTES,
} from "../../../test-support/stubs/stub-api";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const t = texts.catalogue;
const vanille = buildProduct(1, { name: "Vanille", sku: "VAN-01", priceAr: 1000 });
const chocolat = buildProduct(2, { name: "Chocolat", sku: "CHO-01", priceAr: 1500 });
const fraise = buildProduct(3, { name: "Fraise", sku: "FRA-01", available: false });
const mangue = buildProduct(4, { name: "Mangue", sku: "MAN-01", retired: true });

describe("the catalogue list", () => {
  it("shows the active products, the counts and the amounts", async () => {
    await openCatalogue({ [ROUTES.products]: () => list(vanille, chocolat, fraise, mangue) });

    await screen.findByText("Vanille");
    expect(screen.getByText("3 produits · 1 indisponible · 1 retiré")).toBeTruthy();
    expect(screen.queryByText("Mangue")).toBeNull();
    expect(within(rowOf("Chocolat")).getByText("1 500 Ar")).toBeTruthy();
    expect(
      within(screen.getByRole("button", { name: /Indisponibles/ })).getByText("1"),
    ).toBeTruthy();
    expect(within(screen.getByRole("button", { name: /Retirés/ })).getByText("1")).toBeTruthy();
  });

  it("writes the plural from two on", async () => {
    const [one, two] = [
      buildProduct(5, { available: false }),
      buildProduct(6, { available: false }),
    ];
    const gone = [buildProduct(7, { retired: true }), buildProduct(8, { retired: true })];
    await openCatalogue({ [ROUTES.products]: () => list(vanille, one, two, ...gone) });

    expect(await screen.findByText("3 produits · 2 indisponibles · 2 retirés")).toBeTruthy();
  });

  it("says when the shop has no product at all", async () => {
    await openCatalogue({ [ROUTES.products]: () => list() });

    expect(await screen.findByText(t.empty.noProduct)).toBeTruthy();
  });

  it("leaves out the counts that are zero", async () => {
    await openCatalogue({ [ROUTES.products]: () => list(vanille) });

    await screen.findByText("Vanille");
    expect(screen.getByText("1 produit")).toBeTruthy();
  });

  it("filters by tab, and by name or reference ignoring case and accents", async () => {
    await openCatalogue({ [ROUTES.products]: () => list(vanille, chocolat, fraise, mangue) });
    await screen.findByText("Vanille");

    fireEvent.click(screen.getByRole("button", { name: t.tabs.available }));
    expect(screen.queryByText("Fraise")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Retirés/ }));
    expect(screen.getByText("Mangue")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.tabs.all }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "CHO-0" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vaNille" } });
    expect(screen.getByText("Vanille")).toBeTruthy();
    expect(screen.queryByText("Chocolat")).toBeNull();
  });

  it("says when nothing matches and clears the search", async () => {
    await openCatalogue({ [ROUTES.products]: () => list(vanille) });
    await screen.findByText("Vanille");

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText(t.empty.noMatch("zzz"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.empty.clearSearch }));

    expect(screen.getByText("Vanille")).toBeTruthy();
  });

  it("offers a retry when the list cannot be loaded", async () => {
    let attempts = 0;
    await openCatalogue({
      [ROUTES.products]: () => {
        attempts += 1;
        return attempts === 1 ? problemResponse(500) : list(vanille);
      },
    });

    await screen.findByText(t.loadFailed);
    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    expect(await screen.findByText("Vanille")).toBeTruthy();
  });

  it("has no accessibility violation", async () => {
    await openCatalogue({ [ROUTES.products]: () => list(vanille, fraise, mangue) });
    await screen.findByText("Vanille");

    await expectNoAccessibilityViolations(document.body);
  });
});

describe("the availability of a product", () => {
  it("sends the toggle and shows the answer of the server", async () => {
    const api = await openCatalogue({
      [ROUTES.products]: () => list(vanille),
      [productRoute(vanille.id, "availability")]: () =>
        jsonResponse({
          ...vanille,
          available: false,
          availabilityChangedAt: new Date().toISOString(),
        }),
    });
    await screen.findByText("Vanille");

    fireEvent.click(screen.getByRole("switch", { name: t.row.switchLabel("Vanille") }));

    await screen.findByText(t.row.unavailableSince(0));
    expect(bodyOf(api.calls(productRoute(vanille.id, "availability"))[0])).toEqual({
      available: false,
    });
  });

  it("tells the days since the product became unavailable", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await openCatalogue({
      [ROUTES.products]: () => list({ ...fraise, availabilityChangedAt: yesterday }),
    });

    expect(await screen.findByText(t.row.unavailableSince(1))).toBeTruthy();
  });

  it("says the change was not saved, and keeps the row as it was", async () => {
    await openCatalogue({
      [ROUTES.products]: () => list(vanille),
      [productRoute(vanille.id, "availability")]: networkFailure,
    });
    await screen.findByText("Vanille");

    fireEvent.click(screen.getByRole("switch", { name: t.row.switchLabel("Vanille") }));

    await screen.findByText(t.notices.changeFailed);
    expect(screen.getByRole("switch", { name: t.row.switchLabel("Vanille") }).ariaChecked).toBe(
      "true",
    );
  });

  it("reloads the list without a message when the session has ended", async () => {
    let reads = 0;
    await openCatalogue({
      [ROUTES.products]: () => {
        reads += 1;
        return list(vanille);
      },
      [productRoute(vanille.id, "availability")]: () => problemResponse(401),
    });
    await screen.findByText("Vanille");

    fireEvent.click(screen.getByRole("switch", { name: t.row.switchLabel("Vanille") }));

    await waitFor(() => {
      expect(reads).toBe(2);
    });
    expect(screen.queryByText(t.notices.changeFailed)).toBeNull();
  });

  it("reloads the list when the product was retired in the meantime", async () => {
    let reads = 0;
    await openCatalogue({
      [ROUTES.products]: () => {
        reads += 1;
        return list(reads === 1 ? vanille : { ...vanille, retired: true });
      },
      [productRoute(vanille.id, "availability")]: () => problemResponse(409),
    });
    await screen.findByText("Vanille");

    fireEvent.click(screen.getByRole("switch", { name: t.row.switchLabel("Vanille") }));

    await screen.findByText(t.notices.retiredMeanwhile);
    await waitFor(() => {
      expect(screen.queryByText("Vanille", { selector: "span" })).toBeNull();
    });
  });
});

describe("retiring and restoring", () => {
  it("retires a product after a confirmation, then lists it among the retired", async () => {
    const api = await openCatalogue({
      [ROUTES.products]: () => list(vanille, chocolat),
      [productRoute(vanille.id, "retire")]: () => jsonResponse({ ...vanille, retired: true }),
    });
    await screen.findByText("Vanille");

    fireEvent.click(screen.getByRole("button", { name: t.row.menu("Vanille") }));
    fireEvent.click(screen.getByRole("menuitem", { name: t.row.retire }));
    const dialog = screen.getByRole("dialog", { name: t.dialog.title("Vanille") });
    expect(document.activeElement).toBe(
      within(dialog).getByRole("button", { name: t.dialog.cancel }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: t.dialog.confirm }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(api.calls(productRoute(vanille.id, "retire"))).toHaveLength(1);
    expect(screen.queryByText("Vanille", { selector: "span" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Retirés/ }));
    expect(within(rowOf("Vanille")).getByText(t.row.retired)).toBeTruthy();
  });

  it("closes the confirmation with Escape and gives the focus back to the menu button", async () => {
    await openCatalogue({ [ROUTES.products]: () => list(vanille) });
    await screen.findByText("Vanille");

    const trigger = screen.getByRole("button", { name: t.row.menu("Vanille") });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: t.row.retire }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("restores a retired product as unavailable and tells it", async () => {
    await openCatalogue({
      [ROUTES.products]: () => list(vanille, mangue),
      [productRoute(mangue.id, "restore")]: () =>
        jsonResponse({
          ...mangue,
          retired: false,
          available: false,
          position: 9,
          availabilityChangedAt: new Date().toISOString(),
        }),
    });
    await screen.findByText("Vanille");

    fireEvent.click(screen.getByRole("button", { name: /Retirés/ }));
    fireEvent.click(screen.getByRole("button", { name: t.row.menu("Mangue") }));
    fireEvent.click(screen.getByRole("menuitem", { name: t.row.restore }));

    const status = await screen.findByRole("status");
    expect(within(status).getByText(t.notices.restored("Mangue"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Indisponibles/ }));
    expect(within(rowOf("Mangue")).getByText(t.row.unavailableSince(0))).toBeTruthy();
  });

  it("lets an information go away by itself", async () => {
    await openCatalogue({
      [ROUTES.products]: () => list(vanille, mangue),
      [productRoute(mangue.id, "restore")]: () =>
        jsonResponse({
          ...mangue,
          retired: false,
          available: false,
          position: 9,
          availabilityChangedAt: new Date().toISOString(),
        }),
    });
    await screen.findByText("Vanille");
    fireEvent.click(screen.getByRole("button", { name: /Retirés/ }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    fireEvent.click(screen.getByRole("button", { name: t.row.menu("Mangue") }));
    fireEvent.click(screen.getByRole("menuitem", { name: t.row.restore }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(screen.getByText(t.notices.restored("Mangue"))).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(screen.queryByText(t.notices.restored("Mangue"))).toBeNull();
  });
});
