import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import { openAt } from "../../test-support/catalogue/catalogue-harness";
import { bodyOf } from "../../test-support/catalogue/catalogue-queries";
import { buildReseller, daysAgoIso } from "../../test-support/resellers/build-reseller";
import {
  jsonResponse,
  namedProblemResponse,
  networkFailure,
  pendingUntilAborted,
  problemResponse,
  resellerRoute,
  ROUTES,
} from "../../test-support/stubs/stub-api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = texts.resellers;
const LIST_PATH = "/revendeurs";

const resellers = (...items: readonly object[]): (() => Response) => {
  return () => jsonResponse({ resellers: items });
};

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByText(name).closest("tr");
  if (row === null) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};

describe("the list of resellers", () => {
  it("shows the resellers that the API returns, in its order", async () => {
    await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(
        buildReseller(1, { name: "Boutique Mamy", neighborhood: "Isotry" }),
        buildReseller(2, { name: "Épicerie Soa", neighborhood: "Analakely" }),
      ),
    });

    const rows = await screen.findAllByRole("row");

    expect(rows[1]?.textContent).toContain("Boutique Mamy");
    expect(rows[2]?.textContent).toContain("Épicerie Soa");
    expect(screen.getByText("Isotry")).toBeTruthy();
    expect(screen.getByText(t.count(2))).toBeTruthy();
  });

  it("says that there is no reseller yet", async () => {
    await openAt(LIST_PATH, t.title, { [ROUTES.resellers]: resellers() });

    expect(await screen.findByText(t.empty.none)).toBeTruthy();
  });

  it("flags a reseller to verify and not a verified one", async () => {
    await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(
        buildReseller(1, { name: "Kiosque Tsiry", verifiedAt: daysAgoIso(125) }),
        buildReseller(2, { name: "Épicerie Soa", verifiedAt: daysAgoIso(12) }),
      ),
    });
    await screen.findByText("Kiosque Tsiry");

    expect(within(rowOf("Kiosque Tsiry")).getByText(t.row.stale(4))).toBeTruthy();
    expect(within(rowOf("Épicerie Soa")).queryByText(/À vérifier/)).toBeNull();
    expect(within(rowOf("Épicerie Soa")).getByText(t.row.daysAgo(12))).toBeTruthy();
  });

  it("flags a reseller whose agreement is to confirm", async () => {
    await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(
        buildReseller(1, { name: "Épicerie Hery", consentGiven: false, visible: false }),
      ),
    });
    await screen.findByText("Épicerie Hery");

    expect(within(rowOf("Épicerie Hery")).getByText(t.row.consentPending)).toBeTruthy();
  });

  it("filters by the banner and finds a reseller by its neighborhood", async () => {
    await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(
        buildReseller(1, { name: "Kiosque Tsiry", verifiedAt: daysAgoIso(125) }),
        buildReseller(2, { name: "Épicerie Soa", neighborhood: "Analakely" }),
      ),
    });
    await screen.findByText("Épicerie Soa");

    fireEvent.click(screen.getByRole("button", { name: t.banner.show }));
    expect(screen.queryByText("Épicerie Soa")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t.tabs.all}`) }));
    fireEvent.change(screen.getByLabelText(t.searchLabel), { target: { value: "analakely" } });
    expect(screen.queryByText("Kiosque Tsiry")).toBeNull();
    expect(screen.getByText("Épicerie Soa")).toBeTruthy();
  });

  it("switches the visibility of a reseller from its row and shows the answer", async () => {
    const reseller = buildReseller(1, { name: "Épicerie Soa", visible: true });
    const api = await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(reseller),
      [resellerRoute(reseller.id, "PATCH")]: () => jsonResponse({ ...reseller, visible: false }),
    });
    await screen.findByText("Épicerie Soa");

    fireEvent.click(
      within(rowOf("Épicerie Soa")).getByRole("switch", {
        name: t.row.switchLabel("Épicerie Soa"),
      }),
    );

    await waitFor(() => {
      expect(within(rowOf("Épicerie Soa")).getByText(t.row.no)).toBeTruthy();
    });
    expect(bodyOf(api.calls(resellerRoute(reseller.id, "PATCH"))[0])).toEqual({ visible: false });
  });

  it("does not publish a reseller whose agreement is to confirm, and offers its sheet", async () => {
    const reseller = buildReseller(1, {
      name: "Épicerie Hery",
      consentGiven: false,
      visible: false,
    });
    const api = await openAt(LIST_PATH, t.title, { [ROUTES.resellers]: resellers(reseller) });
    await screen.findByText("Épicerie Hery");

    fireEvent.click(screen.getByRole("switch", { name: t.row.switchLabel("Épicerie Hery") }));

    expect(screen.getByText(t.notices.notPublishable("Épicerie Hery"))).toBeTruthy();
    expect(api.calls(resellerRoute(reseller.id, "PATCH"))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: t.notices.openSheet }));
    expect(await screen.findByRole("heading", { name: "Épicerie Hery" })).toBeTruthy();
  });

  it("says why when the server refuses to publish, and says nothing when the session ended", async () => {
    const refused = buildReseller(1, { name: "Épicerie Soa", visible: false });
    const ended = buildReseller(2, { name: "Boutique Mamy", visible: false });
    await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(refused, ended),
      [resellerRoute(refused.id, "PATCH")]: () =>
        namedProblemResponse(422, "reseller_not_publishable"),
      [resellerRoute(ended.id, "PATCH")]: () => problemResponse(401),
    });
    await screen.findByText("Épicerie Soa");

    fireEvent.click(screen.getByRole("switch", { name: t.row.switchLabel("Boutique Mamy") }));
    await waitFor(() => {
      expect(screen.queryByText(t.notices.changeFailed)).toBeNull();
    });
    fireEvent.click(screen.getByRole("switch", { name: t.row.switchLabel("Épicerie Soa") }));

    expect(await screen.findByText(t.notices.notPublishable("Épicerie Soa"))).toBeTruthy();
  });

  it("says that the change failed and leaves the row as it was", async () => {
    const reseller = buildReseller(1, { name: "Épicerie Soa", visible: true });
    await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(reseller),
      [resellerRoute(reseller.id, "PATCH")]: () => problemResponse(500),
    });
    await screen.findByText("Épicerie Soa");

    fireEvent.click(screen.getByRole("switch", { name: t.row.switchLabel("Épicerie Soa") }));

    expect(await screen.findByText(t.notices.changeFailed)).toBeTruthy();
    expect(within(rowOf("Épicerie Soa")).getByText(t.row.yes)).toBeTruthy();
  });

  it("says how old each verification is, and when there was none", async () => {
    await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(
        buildReseller(1, { name: "Soa", verifiedAt: daysAgoIso(0) }),
        buildReseller(2, { name: "Mamy", verifiedAt: daysAgoIso(1) }),
        buildReseller(3, { name: "Tsiry", verifiedAt: null }),
      ),
    });
    await screen.findByText("Soa");

    expect(within(rowOf("Soa")).getByText(t.row.today)).toBeTruthy();
    expect(within(rowOf("Mamy")).getByText(t.row.yesterday)).toBeTruthy();
    expect(within(rowOf("Tsiry")).getByText(t.row.stale(null))).toBeTruthy();
  });

  it("offers to show everything again when the search finds nothing", async () => {
    await openAt(LIST_PATH, t.title, { [ROUTES.resellers]: resellers(buildReseller(1)) });
    await screen.findByText("Revendeur 1");

    fireEvent.change(screen.getByLabelText(t.searchLabel), { target: { value: "zzz" } });
    expect(screen.getByText(t.empty.noMatch("zzz"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.empty.showAll }));

    expect(screen.getByText("Revendeur 1")).toBeTruthy();
  });

  it("shows a loading state while the list is read", async () => {
    await openAt(LIST_PATH, t.title, { [ROUTES.resellers]: pendingUntilAborted });

    expect(screen.getByRole("status").textContent).toBe(t.loading);
  });

  it("shows an error with a retry that reads the list again", async () => {
    const api = await openAt(LIST_PATH, t.title, { [ROUTES.resellers]: networkFailure });

    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    await waitFor(() => {
      expect(api.calls(ROUTES.resellers)).toHaveLength(2);
    });
  });

  it("has no accessibility violation", async () => {
    await openAt(LIST_PATH, t.title, {
      [ROUTES.resellers]: resellers(buildReseller(1), buildReseller(2, { visible: false })),
    });
    await screen.findByText("Revendeur 1");

    await expectNoAccessibilityViolations(document.body);
  });
});
