import type { DeliverySettings } from "@entana/contracts";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../../test-support/assertions/expect-no-accessibility-violations";
import { openAt } from "../../../test-support/catalogue/catalogue-harness";
import { bodyOf } from "../../../test-support/catalogue/catalogue-queries";
import {
  jsonResponse,
  pendingUntilAborted,
  problemResponse,
  ROUTES,
} from "../../../test-support/stubs/stub-api";
import type { ApiStub } from "../../../test-support/stubs/stub-api";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const t = texts.settings;
const NO_BREAK_SPACE = "\u00a0";
// Testing Library reads the text of the page with its no-break spaces made plain.
const asRead = (text: string): string => text.replaceAll(NO_BREAK_SPACE, " ");

const SAVED: DeliverySettings = {
  outOfAxisFeeAr: 4000,
  freeDeliveryMinPieces: 10,
  outOfAxisMessage: "Votre adresse est hors de nos axes de livraison.",
};

const openSettings = (
  path: "/parametres" | "/parametres/textes",
  settings: DeliverySettings = SAVED,
): Promise<ApiStub> =>
  openAt(path, t.title, {
    [ROUTES.settings]: () => jsonResponse(settings),
    // What the answer holds is not looked at here: only what was sent and what is shown.
    [ROUTES.updateSettings]: () => jsonResponse(settings),
  });

const type = (label: string, value: string): void => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const save = (): void => {
  fireEvent.click(screen.getByRole("button", { name: t.save }));
};

const sentBodies = (api: ApiStub): unknown[] => api.calls(ROUTES.updateSettings).map(bodyOf);

describe("the way to the settings", () => {
  it("adds « Paramètres » to the navigation and marks it current", async () => {
    await openSettings("/parametres");

    const navigation = screen.getByRole("navigation", { name: texts.orders.navLabel });
    const link = within(navigation).getByRole("link", { name: t.title });
    expect(link.getAttribute("aria-current")).toBe("page");
  });
});

describe("the tab « Axes et frais »", () => {
  it("shows the saved fee and threshold, under its own address", async () => {
    await openSettings("/parametres");

    const fee = await screen.findByLabelText<HTMLInputElement>(t.fees.fee);
    expect(fee.value).toBe(`4${NO_BREAK_SPACE}000`);
    expect(screen.getByLabelText<HTMLInputElement>(t.fees.threshold).value).toBe("10");
    const tabs = screen.getByRole("navigation", { name: t.tabsLabel });
    expect(within(tabs).getByRole("link", { name: t.tabs.fees }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("has no accessibility violation", async () => {
    await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);

    await expectNoAccessibilityViolations(document.body);
  });

  it("keeps « Enregistrer » disabled while nothing changed", async () => {
    const api = await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);

    save();

    expect(screen.getByRole("button", { name: t.save }).getAttribute("aria-disabled")).toBe("true");
    expect(api.calls(ROUTES.updateSettings)).toHaveLength(0);
  });

  it("sends only the fee when only the fee changed, then confirms", async () => {
    const api = await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);

    type(t.fees.fee, "5 000");
    save();

    expect(await screen.findByText(t.notices.saved)).toBeTruthy();
    expect(sentBodies(api)).toEqual([{ outOfAxisFeeAr: 5000 }]);
  });

  it("sends only the threshold when only the threshold changed", async () => {
    const api = await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);

    type(t.fees.threshold, "12");
    save();

    await screen.findByText(t.notices.saved);
    expect(sentBodies(api)).toEqual([{ freeDeliveryMinPieces: 12 }]);
  });

  it("refuses an empty fee without sending anything", async () => {
    const api = await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);

    type(t.fees.fee, "");
    save();

    expect(screen.getByText(asRead(t.fees.feeError))).toBeTruthy();
    expect(api.calls(ROUTES.updateSettings)).toHaveLength(0);
  });

  it("refuses a threshold of zero without sending anything", async () => {
    const api = await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);

    type(t.fees.threshold, "0");
    save();

    expect(screen.getByText(asRead(t.fees.thresholdError))).toBeTruthy();
    expect(api.calls(ROUTES.updateSettings)).toHaveLength(0);
  });

  it("removes the error once the value is fixed", async () => {
    await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);
    type(t.fees.fee, "");
    save();

    type(t.fees.fee, "5000");

    expect(screen.queryByText(asRead(t.fees.feeError))).toBeNull();
  });

  it("sends a save once, even when « Enregistrer » is pressed again meanwhile", async () => {
    const api = await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);
    api.answer(ROUTES.updateSettings, pendingUntilAborted);

    type(t.fees.fee, "5000");
    save();
    save();

    expect(api.calls(ROUTES.updateSettings)).toHaveLength(1);
  });

  it("goes to the sign-in when the session ended before the save", async () => {
    const api = await openSettings("/parametres");
    await screen.findByLabelText(t.fees.fee);
    api.answer(ROUTES.updateSettings, () => problemResponse(401));
    api.answer(ROUTES.settings, () => problemResponse(401));
    api.answer(ROUTES.me, () => problemResponse(401));

    type(t.fees.fee, "5000");
    save();

    expect(await screen.findByRole("heading", { name: texts.login.title })).toBeTruthy();
  });

  it.each([
    [422, t.notices.invalid],
    [429, t.notices.rateLimited],
    [500, t.notices.failed],
  ])(
    "says why a save answered %i was refused, never with the server's words",
    async (status, text) => {
      const api = await openSettings("/parametres");
      await screen.findByLabelText(t.fees.fee);
      api.answer(ROUTES.updateSettings, () => problemResponse(status));

      type(t.fees.fee, "5000");
      save();

      expect(await screen.findByText(text)).toBeTruthy();
      expect(screen.queryByText(/SECRET/)).toBeNull();
    },
  );
});

describe("the tab « Textes »", () => {
  it("shows the saved message, under its own address", async () => {
    await openSettings("/parametres/textes");

    const message = await screen.findByLabelText<HTMLTextAreaElement>(t.texts.message);
    expect(message.value).toBe(SAVED.outOfAxisMessage);
  });

  it("has no accessibility violation", async () => {
    await openSettings("/parametres/textes");
    await screen.findByLabelText(t.texts.message);

    await expectNoAccessibilityViolations(document.body);
  });

  it("previews the message being typed with the saved fee", async () => {
    await openSettings("/parametres/textes");
    await screen.findByLabelText(t.texts.message);

    type(t.texts.message, "Des frais s'appliquent.");

    const preview = screen.getByRole("region", { name: t.preview.title });
    expect(within(preview).getByText("Des frais s'appliquent.")).toBeTruthy();
    expect(within(preview).getByText("4 000 Ar")).toBeTruthy();
  });

  it("shows markup in the message as text", async () => {
    await openSettings("/parametres/textes", { ...SAVED, outOfAxisMessage: "<b>Frais</b>" });
    await screen.findByLabelText(t.texts.message);

    const preview = screen.getByRole("region", { name: t.preview.title });
    expect(within(preview).getByText("<b>Frais</b>")).toBeTruthy();
    expect(preview.querySelector("b")).toBeNull();
  });

  it("sends only the message when only the message changed", async () => {
    const api = await openSettings("/parametres/textes");
    await screen.findByLabelText(t.texts.message);

    type(t.texts.message, "Des frais s'appliquent.");
    save();

    await screen.findByText(t.notices.saved);
    expect(sentBodies(api)).toEqual([{ outOfAxisMessage: "Des frais s'appliquent." }]);
  });

  it.each([
    ["empty", "  ", t.texts.messageEmpty],
    ["longer than 200 characters", "a".repeat(201), t.texts.messageTooLong],
  ])("refuses a message that is %s without sending anything", async (_case, value, error) => {
    const api = await openSettings("/parametres/textes");
    await screen.findByLabelText(t.texts.message);

    type(t.texts.message, value);
    save();

    expect(screen.getByText(error)).toBeTruthy();
    expect(api.calls(ROUTES.updateSettings)).toHaveLength(0);
  });
});

describe("the loading of the settings", () => {
  it("shows a skeleton while the settings load", async () => {
    await openAt("/parametres", t.title, { [ROUTES.settings]: pendingUntilAborted });

    expect(screen.getByText(texts.common.loading).closest("[aria-busy='true']")).not.toBeNull();
  });

  it("offers to retry when the settings could not be read", async () => {
    const api = await openAt("/parametres", t.title, {
      [ROUTES.settings]: () => problemResponse(500),
    });
    await screen.findByText(t.loadFailed);
    api.answer(ROUTES.settings, () => jsonResponse(SAVED));

    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    expect(await screen.findByLabelText(t.fees.fee)).toBeTruthy();
  });
});
