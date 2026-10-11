import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../../i18n/texts";
import {
  TAPPED,
  TAPPED_ROUNDED,
  continueButtons,
  landmarkField,
  readyMap,
  renderAt,
  renderDelivery,
} from "../../../test-support/harnesses/delivery-harness";
import { expectNoAccessibilityViolations } from "../../../test-support/assertions/expect-no-accessibility-violations";
import { createFakeMapLoader } from "../../../test-support/stubs/fake-map";
import { DELIVERY_DRAFT_STORAGE_KEY } from "../delivery-draft/delivery-draft-storage";

// The CSS of the screen, read as text: jsdom applies no style sheet, so the layout rules that
// decide what is shown at which width are checked on the files.
const BAR_CSS = "../../../components/bottom-bar/bottom-bar.module.css";
const FORM_CSS = "./delivery-form.module.css";
const CART_CSS = "../../cart/cart-screen/cart-screen.module.css";
const styleSheets = import.meta.glob<string>(
  [
    "../../../components/bottom-bar/bottom-bar.module.css",
    "./delivery-form.module.css",
    "../../cart/cart-screen/cart-screen.module.css",
  ],
  { query: "?raw", import: "default", eager: true },
);

/** The rules that apply to every width, and the ones that apply from the one breakpoint. */
function splitAtBreakpoint(css: string | undefined): { base: string; wide: string } {
  if (css === undefined) {
    throw new Error("A style sheet is missing");
  }
  const [base = "", wide = ""] = css.split("@media (min-width: 1024px)");
  return { base, wide };
}

const LANDMARK = "Portail bleu, près de l'école";

beforeEach(() => {
  document.title = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const type = (value: string): void => {
  fireEvent.change(landmarkField(), { target: { value } });
};

describe("the delivery form", () => {
  it("asks for a landmark, with its hint, marked as required", async () => {
    await renderDelivery(createFakeMapLoader());

    expect(landmarkField().getAttribute("aria-required")).toBe("true");
    expect(landmarkField().getAttribute("maxlength")).toBe("200");
    expect(landmarkField().getAttribute("autocomplete")).toBe("off");
    expect(screen.getByText(texts.delivery.landmark.hint)).toBeTruthy();
    expect(landmarkField().getAttribute("aria-describedby")).toBe(
      screen.getByText(texts.delivery.landmark.hint).id,
    );
  });

  it.each([
    ["empty", ""],
    ["two characters", "ab"],
    ["201 characters", "a".repeat(201)],
    ["a control character", "portail\u0007bleu"],
  ])(
    "refuses a landmark that is %s, says why and puts the focus on the field",
    async (_label, text) => {
      const fake = createFakeMapLoader();
      await renderDelivery(fake);
      const map = await readyMap(fake);
      act(() => {
        map.pick(TAPPED);
      });
      type(text);

      fireEvent.click(continueButtons().card);

      expect(await screen.findByText(texts.delivery.landmark.error)).toBeTruthy();
      expect(landmarkField().getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(landmarkField());
      expect(window.location.pathname).toBe("/livraison");
    },
  );

  it("refuses to continue without a point: one notice, with the focus on it", async () => {
    await renderDelivery(createFakeMapLoader());
    type(LANDMARK);

    fireEvent.click(continueButtons().bar);

    const notice = await screen.findByRole("alert");
    expect(screen.getAllByText(texts.delivery.pointMissing)).toHaveLength(1);
    expect(notice.textContent).toBe(texts.delivery.pointMissing);
    expect(document.activeElement).toBe(notice);
    expect(window.location.pathname).toBe("/livraison");
  });

  it("shows both errors together, the focus on the first in visual order, and clears each when fixed", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);

    fireEvent.click(continueButtons().card);

    const notice = await screen.findByRole("alert");
    expect(screen.getByText(texts.delivery.landmark.error)).toBeTruthy();
    expect(document.activeElement).toBe(notice);

    act(() => {
      map.pick(TAPPED);
    });
    expect(screen.queryByText(texts.delivery.pointMissing)).toBeNull();
    expect(screen.getByText(texts.delivery.landmark.error)).toBeTruthy();

    type(LANDMARK);
    expect(screen.queryByText(texts.delivery.landmark.error)).toBeNull();
    expect(landmarkField().getAttribute("aria-invalid")).toBeNull();
  });

  it("has no accessibility violation with both errors shown", async () => {
    await renderDelivery(createFakeMapLoader());

    fireEvent.click(continueButtons().card);

    await screen.findByRole("alert");
    await expectNoAccessibilityViolations(document.body);
  });

  it("shows the delivery section, free, once", async () => {
    await renderDelivery(createFakeMapLoader());

    expect(screen.getAllByText(texts.delivery.fee.label)).toHaveLength(1);
    expect(screen.getAllByText(texts.delivery.fee.free)).toHaveLength(1);
  });

  it.each([
    ["the button of the fixed bar", (): HTMLElement => continueButtons().bar],
    ["the button of the side card", (): HTMLElement => continueButtons().card],
  ])(
    "goes to the contact screen with %s once the point and the landmark are valid",
    async (_label, button) => {
      const fake = createFakeMapLoader();
      await renderDelivery(fake);
      const map = await readyMap(fake);
      act(() => {
        map.pick(TAPPED);
      });
      type(LANDMARK);

      fireEvent.click(button());

      await waitFor(() => {
        expect(window.location.pathname).toBe("/coordonnees");
      });
      expect(JSON.parse(sessionStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY) ?? "null")).toEqual({
        version: 1,
        point: TAPPED_ROUNDED,
        landmark: LANDMARK,
      });
    },
  );

  it("submits from the field: it sits in a form that has a submit button and no native validation", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);
    act(() => {
      map.pick(TAPPED);
    });
    type(LANDMARK);
    const form = landmarkField().form;

    // jsdom does not turn the Enter key into a submission, the browser does for a form with a
    // submit button: what is checked here is that the form is what a browser needs for it.
    expect(form?.noValidate).toBe(true);
    expect(form?.querySelector('button[type="submit"]')).not.toBeNull();
    expect(continueButtons().bar.getAttribute("form")).toBe(form?.id);
    act(() => {
      form?.requestSubmit();
    });

    await waitFor(() => {
      expect(window.location.pathname).toBe("/coordonnees");
    });
  });

  it("shows one Continuer at a time: the bar on a phone, the card from 1024 px, never visually hidden", () => {
    const bar = splitAtBreakpoint(styleSheets[BAR_CSS]);
    const form = splitAtBreakpoint(styleSheets[FORM_CSS]);
    const cart = splitAtBreakpoint(styleSheets[CART_CSS]);

    expect(bar.base).not.toMatch(/\.bar\s*\{[^}]*display:\s*none/);
    expect(bar.wide).toMatch(/\.bar\s*\{[^}]*display:\s*none/);
    for (const { base, wide } of [form, cart]) {
      expect(base).toMatch(/\.desktopAction\s*\{[^}]*display:\s*none/);
      expect(wide).toMatch(/\.desktopAction\s*\{[^}]*display:\s*block/);
    }
    for (const { base, wide } of [bar, form, cart]) {
      expect(base + wide).not.toMatch(/visibility:\s*hidden|opacity:\s*0\s*;|clip(-path)?:/);
    }
  });
});

describe("the delivery draft", () => {
  it("is restored after the screen is left: field filled, point back on the map, centred on it", async () => {
    const first = createFakeMapLoader();
    await renderDelivery(first);
    const firstMap = await readyMap(first);
    act(() => {
      firstMap.pick(TAPPED);
    });
    type(LANDMARK);
    cleanup();

    const second = createFakeMapLoader();
    renderAt("/livraison", second);
    await waitFor(() => {
      expect(second.loader).toHaveBeenCalledOnce();
    });
    const map = await readyMap(second);

    expect(landmarkField().value).toBe(LANDMARK);
    await waitFor(() => {
      expect(map.markers.at(-1)).toEqual(TAPPED_ROUNDED);
    });
    expect(map.centrings).toEqual([{ point: TAPPED_ROUNDED, zoom: 16 }]);
  });

  it("starts empty when what was stored is of another version", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    sessionStorage.setItem(
      DELIVERY_DRAFT_STORAGE_KEY,
      JSON.stringify({ version: 2, point: TAPPED_ROUNDED, landmark: LANDMARK }),
    );
    cleanup();

    const second = createFakeMapLoader();
    renderAt("/livraison", second);
    await waitFor(() => {
      expect(second.loader).toHaveBeenCalledOnce();
    });
    const map = await readyMap(second);

    expect(landmarkField().value).toBe("");
    expect(map.markers.filter((marker) => marker !== null)).toHaveLength(0);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("goes on working in memory when the storage is not available", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    act(() => {
      map.pick(TAPPED);
    });
    type(LANDMARK);

    fireEvent.click(continueButtons().card);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/coordonnees");
    });
  });

  it("is kept when the customer goes to the cart and comes back, without a reload", async () => {
    const fake = createFakeMapLoader();
    await renderDelivery(fake);
    const map = await readyMap(fake);
    act(() => {
      map.pick(TAPPED);
    });
    type(LANDMARK);

    fireEvent.click(screen.getByRole("link", { name: texts.shell.backToCart }));
    await screen.findByRole("heading", { level: 1, name: texts.cart.screen.heading });
    window.history.back();

    await waitFor(() => {
      expect(landmarkField().value).toBe(LANDMARK);
    });
  });
});
