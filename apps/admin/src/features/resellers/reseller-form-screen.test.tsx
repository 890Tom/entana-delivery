import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import { openAt } from "../../test-support/catalogue/catalogue-harness";
import { bodyOf } from "../../test-support/catalogue/catalogue-queries";
import { buildReseller } from "../../test-support/resellers/build-reseller";
import {
  jsonResponse,
  namedProblemResponse,
  problemResponse,
  resellerRoute,
  ROUTES,
} from "../../test-support/stubs/stub-api";
import type { PositionMapOptions } from "./map/position-map-adapter";

// The library needs WebGL: the adapter that names it is the external boundary.
const mapLoader = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("./map/position-map-adapter", () => ({ loadPositionMap: mapLoader.load }));

const t = texts.resellers.form;
const NEW_PATH = "/revendeurs/nouveau";

let mapOptions: PositionMapOptions | undefined;
const setPoint = vi.fn();

beforeEach(() => {
  mapOptions = undefined;
  setPoint.mockReset();
  mapLoader.load.mockReset();
  mapLoader.load.mockImplementation((options: PositionMapOptions) => {
    mapOptions = options;
    return Promise.resolve({ setPoint, destroy: vi.fn() });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const emptyList = (): Response => jsonResponse({ resellers: [] });

const openNew = (): ReturnType<typeof openAt> =>
  openAt(NEW_PATH, t.newTitle, { [ROUTES.resellers]: emptyList });

const openEdit = (
  reseller: ReturnType<typeof buildReseller>,
  handlers: Parameters<typeof openAt>[2] = {},
): ReturnType<typeof openAt> =>
  openAt(`/revendeurs/${reseller.id}`, reseller.name, {
    [ROUTES.resellers]: () => jsonResponse({ resellers: [reseller] }),
    ...handlers,
  });

const type = (label: string, value: string): void => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const click = (label: string): void => {
  fireEvent.click(screen.getByRole("button", { name: label }));
};

function fillAll(): void {
  type(t.information.name, "Épicerie Soa");
  type(t.information.neighborhood, "Analakely");
  type(t.information.landmark, "Face à la pharmacie");
  type(t.map.latitude, "-18.9097");
  type(t.map.longitude, "47.5236");
}

async function pickOnMap(lat: number, lng: number): Promise<void> {
  await waitFor(() => {
    expect(mapOptions).toBeDefined();
  });
  act(() => {
    mapOptions?.onPick({ lat, lng });
  });
}

describe("the creation of a reseller", () => {
  it("sends the seven fields, then goes back to the list", async () => {
    const api = await openNew();
    type(t.information.name, "Épicerie Soa");
    type(t.information.neighborhood, "Analakely");
    type(t.information.landmark, "Face à la pharmacie");
    await pickOnMap(-18.9097, 47.5236);
    api.answer(ROUTES.createReseller, () => jsonResponse(buildReseller(1), 201));

    click(t.buttons.create);

    expect(await screen.findByRole("heading", { name: texts.resellers.title })).toBeTruthy();
    expect(bodyOf(api.calls(ROUTES.createReseller)[0])).toEqual({
      name: "Épicerie Soa",
      neighborhood: "Analakely",
      landmark: "Face à la pharmacie",
      latitude: -18.9097,
      longitude: 47.5236,
      consentGiven: false,
      visible: false,
    });
  });

  it.each([
    ["landmark", t.information.landmark, t.errors.landmark],
    ["latitude", t.map.latitude, t.errors.latitude],
    ["longitude", t.map.longitude, t.errors.longitude],
  ])("refuses a form without %s and sends nothing", async (_field, label, message) => {
    const api = await openNew();
    fillAll();
    type(label, "");

    click(t.buttons.create);

    expect(screen.getByText(message)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(label));
    expect(api.calls(ROUTES.createReseller)).toHaveLength(0);
  });
});

describe("the publication", () => {
  it("cannot make a reseller visible without its agreement", async () => {
    await openNew();
    const visible = screen.getByRole("switch", { name: t.publication.visible });

    fireEvent.click(visible);

    expect(visible.getAttribute("aria-checked")).toBe("false");
    expect(visible.getAttribute("aria-disabled")).toBe("true");
  });

  it("cannot withdraw the agreement of a visible reseller", async () => {
    await openEdit(buildReseller(1, { consentGiven: true, visible: true }));
    const consent = screen.getByRole("checkbox", { name: t.publication.consent });

    fireEvent.click(consent);

    expect((consent as HTMLInputElement).checked).toBe(true);
  });

  it("says why when the server refuses to publish", async () => {
    const reseller = buildReseller(1, { consentGiven: true, visible: false });
    await openEdit(reseller, {
      [resellerRoute(reseller.id, "PATCH")]: () =>
        namedProblemResponse(422, "reseller_not_publishable"),
    });

    fireEvent.click(screen.getByRole("switch", { name: t.publication.visible }));
    click(t.buttons.save);

    expect(await screen.findByText(t.errors.notPublishable)).toBeTruthy();
    expect(screen.queryByText("SECRET-DETAIL")).toBeNull();
  });
});

describe("the failures", () => {
  it("keeps the input and says that the save failed", async () => {
    const reseller = buildReseller(1);
    const api = await openEdit(reseller, {
      [resellerRoute(reseller.id, "PATCH")]: () => problemResponse(500),
    });

    type(t.information.name, "Nouveau nom");
    click(t.buttons.save);

    expect(await screen.findByText(t.notices.saveFailed)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(t.information.name).value).toBe("Nouveau nom");
    expect(screen.queryByText("SECRET-DETAIL")).toBeNull();
    expect(api.calls(resellerRoute(reseller.id, "PATCH"))).toHaveLength(1);
  });

  it("says that the reseller is gone when the change meets a 404", async () => {
    const reseller = buildReseller(1);
    await openEdit(reseller, {
      [resellerRoute(reseller.id, "PATCH")]: () => problemResponse(404),
    });

    type(t.information.name, "Nouveau nom");
    click(t.buttons.save);

    expect(await screen.findByText(t.notices.gone)).toBeTruthy();
  });

  it("says that the verification or the deletion failed, and stays on the form", async () => {
    const reseller = buildReseller(1);
    await openEdit(reseller, {
      [resellerRoute(reseller.id, "POST")]: () => problemResponse(500),
      [resellerRoute(reseller.id, "DELETE")]: () => problemResponse(500),
    });

    click(t.verification.mark);
    expect(await screen.findByText(t.notices.verifyFailed)).toBeTruthy();

    click(t.buttons.delete);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: t.dialog.confirm }),
    );

    expect(await screen.findByText(t.notices.deleteFailed)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the coordinates editable when the map cannot be loaded, and retries", async () => {
    mapLoader.load.mockRejectedValueOnce(new Error("no map"));
    await openNew();

    expect(await screen.findByText(t.map.failed)).toBeTruthy();
    expect(screen.getByLabelText(t.map.latitude)).toBeTruthy();

    click(texts.common.retry);
    await waitFor(() => {
      expect(mapLoader.load).toHaveBeenCalledTimes(2);
    });
  });
});

describe("the form of a reseller that exists", () => {
  it("goes back to the list without a request when nothing changed", async () => {
    const reseller = buildReseller(1);
    const api = await openEdit(reseller);

    click(t.buttons.save);

    expect(await screen.findByRole("heading", { name: texts.resellers.title })).toBeTruthy();
    expect(api.calls(resellerRoute(reseller.id, "PATCH"))).toHaveLength(0);
  });

  it("says when the reseller was never verified", async () => {
    await openEdit(buildReseller(1, { verifiedAt: null }));

    expect(screen.getByText(t.verification.never)).toBeTruthy();
    expect(screen.getByText(t.status.visible)).toBeTruthy();
  });

  it("says nothing of its own when the session ended during a verification", async () => {
    const reseller = buildReseller(1);
    await openEdit(reseller, {
      [resellerRoute(reseller.id, "POST")]: () => problemResponse(401),
    });

    click(t.verification.mark);

    await waitFor(() => {
      expect(screen.queryByText(t.notices.verifyFailed)).toBeNull();
    });
  });
});

describe("the position", () => {
  it("fills the coordinates when the marker is moved on the map", async () => {
    await openNew();

    await pickOnMap(-18.91, 47.52);

    expect(screen.getByLabelText<HTMLInputElement>(t.map.latitude).value).toBe("-18.91");
    expect(screen.getByLabelText<HTMLInputElement>(t.map.longitude).value).toBe("47.52");
  });

  it("moves the marker when the coordinates are typed", async () => {
    await openNew();
    await waitFor(() => {
      expect(mapOptions).toBeDefined();
    });
    setPoint.mockClear();

    type(t.map.latitude, "-18,5");
    type(t.map.longitude, "47.4");

    await waitFor(() => {
      expect(setPoint).toHaveBeenLastCalledWith({ lat: -18.5, lng: 47.4 });
    });
  });
});

describe("the change of a reseller", () => {
  it("sends the latitude and the longitude together", async () => {
    const reseller = buildReseller(1);
    const api = await openEdit(reseller, {
      [resellerRoute(reseller.id, "PATCH")]: () => jsonResponse({ ...reseller, latitude: -18.5 }),
    });

    type(t.map.latitude, "-18.5");
    click(t.buttons.save);

    await screen.findByRole("heading", { name: texts.resellers.title });
    expect(bodyOf(api.calls(resellerRoute(reseller.id, "PATCH"))[0])).toEqual({
      latitude: -18.5,
      longitude: reseller.longitude,
    });
  });

  it("marks the reseller as verified today", async () => {
    const reseller = buildReseller(1);
    await openEdit(reseller, {
      [resellerRoute(reseller.id, "POST")]: () =>
        jsonResponse({ ...reseller, verifiedAt: new Date().toISOString() }),
    });

    click(t.verification.mark);

    expect(await screen.findByText(t.verification.marked)).toBeTruthy();
  });

  it("shows the page not found for an unknown id", async () => {
    await openAt("/revendeurs/0199f5b0-7c1e-7a3b-9d4f-00000000dead", texts.notFound.title, {
      [ROUTES.resellers]: () => jsonResponse({ resellers: [buildReseller(1)] }),
    });

    expect(screen.getByText(texts.notFound.message)).toBeTruthy();
  });
});

describe("the deletion of a reseller", () => {
  it("asks first, names the reseller and sends nothing when cancelled", async () => {
    const reseller = buildReseller(1, { name: "Épicerie Soa" });
    const api = await openEdit(reseller);

    click(t.buttons.delete);
    const dialog = screen.getByRole("dialog", { name: t.dialog.title("Épicerie Soa") });
    expect(within(dialog).getByText(t.dialog.body)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: t.dialog.cancel }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(api.calls(resellerRoute(reseller.id, "DELETE"))).toHaveLength(0);
  });

  it("deletes after the confirmation and goes back to a list without the reseller", async () => {
    const reseller = buildReseller(1, { name: "Épicerie Soa" });
    const api = await openEdit(reseller, {
      [resellerRoute(reseller.id, "DELETE")]: () => new Response(null, { status: 204 }),
    });
    api.answer(ROUTES.resellers, emptyList);

    click(t.buttons.delete);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: t.dialog.confirm }));

    expect(await screen.findByText(texts.resellers.empty.none)).toBeTruthy();
    expect(api.calls(resellerRoute(reseller.id, "DELETE"))).toHaveLength(1);
    expect(screen.queryByText("Épicerie Soa")).toBeNull();
  });
});

describe("the page of the form", () => {
  it("has no accessibility violation", async () => {
    await openEdit(buildReseller(1));

    await expectNoAccessibilityViolations(document.body);
  });
});
