import { MAX_CONTACT_NAME_LENGTH, MAX_CUSTOMER_NOTE_LENGTH } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  NAME,
  NOTE,
  PHONE,
  continueButtons,
  fillValidContact,
  nameField,
  noteField,
  openContact,
  phoneField,
  summaryCard,
  typeInto,
} from "../../test-support/contact-harness";
import { buildInstance } from "../../test-support/build-instance";
import { expectNoAccessibilityViolations } from "../../test-support/expect-no-accessibility-violations";

import { CONTACT_DRAFT_STORAGE_KEY } from "./contact-draft/contact-draft-storage";

// The CSS of the screen, read as text: jsdom applies no style sheet, so the rules that decide
// what is shown at which width are checked on the files.
const SCREEN_CSS = "./contact-screen.module.css";
const BAR_CSS = "../../components/bottom-bar/bottom-bar.module.css";
const styleSheets = import.meta.glob<string>(
  ["./contact-screen.module.css", "../../components/bottom-bar/bottom-bar.module.css"],
  { query: "?raw", import: "default", eager: true },
);

function splitAtBreakpoint(css: string | undefined): { base: string; wide: string } {
  if (css === undefined) {
    throw new Error("A style sheet is missing");
  }
  const [base = "", wide = ""] = css.split("@media (min-width: 1024px)");
  return { base, wide };
}

beforeEach(() => {
  document.title = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the contact screen guards", () => {
  it("sends an empty cart back to the cart, replacing the history entry", async () => {
    const lengthBefore = window.history.length;

    openContact({ lines: [] });

    await screen.findByRole("heading", { level: 1, name: texts.cart.screen.heading });
    expect(window.location.pathname).toBe("/panier");
    expect(window.history.length).toBe(lengthBefore + 1);
  });

  it.each([
    ["no point", { version: 1, point: null, landmark: "Portail bleu" }],
    [
      "a landmark that is too short",
      { version: 1, point: { lat: -18.9, lng: 47.5 }, landmark: "ab" },
    ],
    ["nothing", null],
  ])("sends a delivery with %s back to the delivery screen", async (_label, delivery) => {
    openContact({ delivery });

    await screen.findByRole("heading", { level: 1, name: texts.delivery.heading });
    expect(window.location.pathname).toBe("/livraison");
  });
});

describe("the contact form", () => {
  it("asks for the name, the phone number and an optional note", async () => {
    openContact();

    const name = await nameField();
    expect(name.getAttribute("aria-required")).toBe("true");
    expect(name.getAttribute("autocomplete")).toBe("name");
    expect(name.getAttribute("maxlength")).toBe(String(MAX_CONTACT_NAME_LENGTH));
    const phone = await phoneField();
    expect(phone.type).toBe("tel");
    expect(phone.getAttribute("inputmode")).toBe("tel");
    expect(phone.getAttribute("autocomplete")).toBe("tel-national");
    // No maxlength: it would cut a pasted "+261 34 12 345 67" before the field sees it.
    expect(phone.hasAttribute("maxlength")).toBe(false);
    expect(phone.getAttribute("aria-required")).toBe("true");
    expect(phone.getAttribute("placeholder")).toBe(texts.contact.phone.placeholder);
    const note = await noteField();
    expect(note.tagName).toBe("TEXTAREA");
    expect(note.getAttribute("autocomplete")).toBe("off");
    expect(note.getAttribute("maxlength")).toBe(String(MAX_CUSTOMER_NOTE_LENGTH));
    expect(note.getAttribute("aria-required")).toBeNull();
    expect(screen.getByText(texts.common.optional)).toBeTruthy();
  });

  it("shows the country code of the instance, read with the field but never a field itself", async () => {
    openContact();

    const phone = await phoneField();
    const prefix = await screen.findByText("+261");
    expect(phone.getAttribute("aria-describedby")?.split(" ")).toContain(prefix.id);
    // Not a control, not in the label (which would change the name of the field), no tab stop.
    expect(prefix.tagName).toBe("SPAN");
    expect(prefix.hasAttribute("tabindex")).toBe(false);
    expect(prefix.closest("label")).toBeNull();
    expect(phone.labels?.[0]?.textContent).toBe(texts.contact.phone.label);
  });

  it("takes the country code from the instance, not from the code", async () => {
    openContact({ api: { instanceData: buildInstance({ phoneCountryCode: "33" }) } });

    expect(await screen.findByText("+33")).toBeTruthy();
    expect(screen.queryByText("+261")).toBeNull();
    typeInto(await nameField(), NAME);
    typeInto(await phoneField(), "6 12 34 56 78");
    fireEvent.click((await continueButtons()).bar);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/recapitulatif");
    });
  });

  it.each([
    ["the button of the fixed bar", async () => (await continueButtons()).bar],
    ["the button of the side card", async () => (await continueButtons()).card],
  ])("saves the draft and goes on with %s", async (_label, button) => {
    openContact();
    typeInto(await nameField(), NAME);
    typeInto(await phoneField(), "34 12 345 67");
    typeInto(await noteField(), NOTE);

    fireEvent.click(await button());

    await waitFor(() => {
      expect(window.location.pathname).toBe("/recapitulatif");
    });
    expect(JSON.parse(sessionStorage.getItem(CONTACT_DRAFT_STORAGE_KEY) ?? "null")).toEqual({
      version: 1,
      name: NAME,
      phone: "34 12 345 67",
      note: NOTE,
    });
  });

  it("accepts an empty note and never stores it as a note", async () => {
    openContact();
    await fillValidContact();

    fireEvent.click((await continueButtons()).bar);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/recapitulatif");
    });
    expect(JSON.parse(sessionStorage.getItem(CONTACT_DRAFT_STORAGE_KEY) ?? "null")).toMatchObject({
      note: null,
    });
  });

  it("refuses an empty name, says what to do and puts the focus on the field", async () => {
    openContact();
    typeInto(await phoneField(), PHONE);

    fireEvent.click((await continueButtons()).card);

    expect(await screen.findByText(texts.contact.name.error)).toBeTruthy();
    const name = await nameField();
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(name);
    expect(window.location.pathname).toBe("/coordonnees");
  });

  it("refuses a note with a control character", async () => {
    openContact();
    await fillValidContact();
    typeInto(await noteField(), "Avant\t15h");

    fireEvent.click((await continueButtons()).bar);

    expect(await screen.findByText(texts.contact.note.error)).toBeTruthy();
    expect(document.activeElement).toBe(await noteField());
  });

  it("shows every error together, the focus on the first, and clears each when fixed", async () => {
    openContact();
    await nameField();

    fireEvent.click((await continueButtons()).bar);

    expect(await screen.findByText(texts.contact.name.error)).toBeTruthy();
    expect(screen.getByText(texts.contact.phone.errors.invalid)).toBeTruthy();
    expect(document.activeElement).toBe(await nameField());

    typeInto(await nameField(), NAME);
    expect(screen.queryByText(texts.contact.name.error)).toBeNull();
    expect(screen.getByText(texts.contact.phone.errors.invalid)).toBeTruthy();
    typeInto(await phoneField(), PHONE);
    expect(screen.queryByText(texts.contact.phone.errors.invalid)).toBeNull();
  });

  it("shows a notice with a retry in place of the phone field when the instance fails, and does not go on", async () => {
    const { control } = openContact({ api: { instance: "server-error" } });
    const notice = (await screen.findByText(texts.contact.phone.configurationError)).closest(
      "[role=alert]",
    );
    expect(screen.queryByRole("textbox", { name: texts.contact.phone.label })).toBeNull();
    typeInto(await nameField(), NAME);

    fireEvent.click((await continueButtons()).bar);

    expect(window.location.pathname).toBe("/coordonnees");
    expect(document.activeElement).toBe(notice);

    control.instance = "ok";
    fireEvent.click(
      within(notice as HTMLElement).getByRole("button", { name: texts.common.retry }),
    );

    expect(await phoneField()).toBeTruthy();
    expect(await screen.findByText("+261")).toBeTruthy();
  });

  it("waits for the country code: a valid name does not go on, the focus goes to the phone field, no message", async () => {
    openContact({ api: { instance: "pending" } });
    typeInto(await nameField(), NAME);

    fireEvent.click((await continueButtons()).bar);

    expect(document.activeElement).toBe(await phoneField());
    expect(window.location.pathname).toBe("/coordonnees");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(texts.contact.phone.errors.invalid)).toBeNull();
  });
});

describe("the contact screen frame", () => {
  it("has its heading, its document title, step 3 current and a way back to the address", async () => {
    openContact();

    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(
      texts.contact.heading,
    );
    await waitFor(() => {
      expect(document.title).toContain(texts.contact.title);
    });
    const steps = screen.getByRole("navigation", { name: texts.shell.steps.label });
    expect(within(steps).getByText(texts.shell.steps.position(3, 5))).toBeTruthy();
    expect(
      within(steps).getByText(texts.shell.steps.contact).closest("[aria-current=step]"),
    ).not.toBeNull();
    expect(within(steps).getAllByText(texts.shell.steps.done)).toHaveLength(2);
    expect(within(steps).queryAllByRole("link")).toHaveLength(0);
    const back = screen.getByRole("link", { name: texts.shell.backToAddress });
    expect(back.getAttribute("href")).toBe("/livraison");
  });

  it("shows the date notice once in the form column and once in the card, never both at one width", async () => {
    openContact();

    const card = await summaryCard();
    expect(within(card).getByText(texts.contact.dateNotice)).toBeTruthy();
    expect(screen.getAllByText(texts.contact.dateNotice)).toHaveLength(2);
    const screenCss = splitAtBreakpoint(styleSheets[SCREEN_CSS]);
    expect(screenCss.base).toMatch(/\.side\s*\{[^}]*display:\s*none/);
    expect(screenCss.wide).toMatch(/\.side\s*\{[^}]*display:\s*(block|flex)/);
    expect(screenCss.wide).toMatch(/\.phoneOnly\s*\{[^}]*display:\s*none/);
  });

  it("shows one button at a time, never visually hidden", () => {
    const bar = splitAtBreakpoint(styleSheets[BAR_CSS]);
    const screenCss = splitAtBreakpoint(styleSheets[SCREEN_CSS]);

    expect(bar.wide).toMatch(/\.bar\s*\{[^}]*display:\s*none/);
    for (const { base, wide } of [bar, screenCss]) {
      expect(base + wide).not.toMatch(/visibility:\s*hidden|opacity:\s*0\s*;|clip(-path)?:/);
    }
  });

  it("has no accessibility violation with the errors shown", async () => {
    openContact();
    fireEvent.click((await continueButtons()).card);

    await screen.findByText(texts.contact.name.error);
    await expectNoAccessibilityViolations(document.body);
  });
});
