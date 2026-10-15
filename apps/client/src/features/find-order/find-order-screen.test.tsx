import { formatAmount } from "@entana/contracts";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { expectNoAccessibilityViolations } from "../../test-support/assertions/expect-no-accessibility-violations";
import {
  SENT_BODY,
  codeInput,
  fillAndSend,
  formSubmitButton,
  openFindOrder,
  phoneInput,
  sentBody,
} from "../../test-support/harnesses/find-order-harness";
import { resetOrderSubmission } from "../../test-support/order-submission/reset-order-submission";
import {
  feeRowText,
  inSequence,
  itemsLine,
  networkFailure,
  problemAnswer,
  viewAnswer,
} from "../../test-support/harnesses/tracking-harness";

const { findOrder } = texts;

beforeEach(() => {
  resetOrderSubmission();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("the form", () => {
  it("asks for the phone number and the code, in the page, with its help", async () => {
    openFindOrder({ lookup: viewAnswer() });

    await screen.findByRole("heading", { level: 1, name: findOrder.title });
    const code = await codeInput();

    expect(screen.getByText(findOrder.intro)).toBeTruthy();
    expect(screen.getByText(findOrder.code.hint)).toBeTruthy();
    expect(screen.queryByText(texts.contact.phone.hint)).toBeNull();
    expect(code.getAttribute("autocapitalize")).toBe("characters");
    expect(code.getAttribute("autocomplete")).toBe("off");
    expect(code.getAttribute("spellcheck")).toBe("false");
    expect(code.hasAttribute("maxlength")).toBe(false);
    expect(document.title).toBe(`${findOrder.title} — Maison Démo`);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
  });

  it("has the logo alone in the header: no cart badge, no way back, no title", async () => {
    openFindOrder({ lookup: viewAnswer() });
    await codeInput();

    const logo = await screen.findByRole("link", { name: texts.shell.homeLabel("Maison Démo") });
    expect(logo.getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: texts.cart.badgeLabel(0) })).toBeNull();
    // Nor the way to this screen itself: the customer is there already.
    expect(screen.queryByRole("link", { name: findOrder.entry })).toBeNull();
    expect(screen.queryByRole("link", { name: texts.shell.back })).toBeNull();
    expect(within(screen.getByRole("banner")).queryByText(findOrder.title)).toBeNull();
  });

  it("has no accessibility violation", async () => {
    openFindOrder({ lookup: viewAnswer() });
    await codeInput();

    await expectNoAccessibilityViolations(document.body);
  });

  it("refuses a code of the wrong shape without asking the server", async () => {
    const app = openFindOrder({ lookup: viewAnswer() });

    await fillAndSend(undefined, "K7M2");

    const code = await codeInput();
    expect(await screen.findByText(findOrder.code.error)).toBeTruthy();
    expect(code.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(code);
    expect(app.lookupCalls()).toHaveLength(0);
  });

  it("refuses an invalid phone number without asking the server", async () => {
    const app = openFindOrder({ lookup: viewAnswer() });

    await fillAndSend("12", undefined);

    expect(await screen.findByText(texts.contact.phone.errors.missingDigits)).toBeTruthy();
    expect(document.activeElement).toBe(await phoneInput());
    expect(app.lookupCalls()).toHaveLength(0);
  });

  it("shows the message of the phone check when the server refuses the number", async () => {
    openFindOrder({ lookup: problemAnswer(400) });

    await fillAndSend();

    expect(await screen.findByText(texts.contact.phone.errors.invalid)).toBeTruthy();
    expect((await phoneInput()).getAttribute("aria-invalid")).toBe("true");
  });

  it("sends once while busy, and says so", async () => {
    let settle: (() => void) | undefined;
    const app = openFindOrder({
      lookup: () =>
        new Promise((resolve) => {
          settle = () => {
            resolve(new Response(null, { status: 404 }));
          };
        }),
    });

    await fillAndSend();
    await waitFor(() => {
      expect(formSubmitButton().getAttribute("aria-busy")).toBe("true");
    });
    const button = formSubmitButton();
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);

    expect(app.lookupCalls()).toHaveLength(1);
    settle?.();
    await screen.findByText(findOrder.notFound);
  });
});

describe("what a failed lookup says", () => {
  it("says one thing when no order matches", async () => {
    openFindOrder({ lookup: problemAnswer(404) });

    await fillAndSend();

    expect(await screen.findByText(findOrder.notFound)).toBeTruthy();
    expect(screen.queryByText("SECRET-DETAIL")).toBeNull();
  });

  it("asks to wait when the limit is reached, without a retry button", async () => {
    openFindOrder({ lookup: problemAnswer(429) });

    await fillAndSend();

    expect(await screen.findByText(findOrder.rateLimited)).toBeTruthy();
    expect(screen.queryByRole("button", { name: texts.common.retry })).toBeNull();
  });

  it("offers to try again after a network failure, and finds the order then", async () => {
    const app = openFindOrder({ lookup: inSequence(networkFailure, viewAnswer()) });

    await fillAndSend();
    fireEvent.click(await screen.findByRole("button", { name: texts.common.retry }));

    await screen.findByRole("button", { name: findOrder.refresh });
    expect(app.lookupCalls()).toHaveLength(2);
  });
});

describe("the order found", () => {
  it("is read only, with nothing kept and nothing in the address", async () => {
    const app = openFindOrder({ lookup: viewAnswer({ status: "CONFIRMED", canCancel: true }) });

    await fillAndSend();

    await screen.findByRole("button", { name: findOrder.refresh });
    expect(sentBody(app.lookupCalls()[0])).toStrictEqual(SENT_BODY);
    expect(screen.queryByText(texts.tracking.code.label)).toBeNull();
    expect(screen.queryByRole("button", { name: texts.tracking.actions.cancel })).toBeNull();
    expect(screen.queryByRole("button", { name: texts.tracking.link.copy })).toBeNull();
    expect(screen.queryByRole("button", { name: texts.tracking.link.forget })).toBeNull();
    expect(screen.queryByText(texts.tracking.thanks)).toBeNull();
    expect(localStorage).toHaveLength(0);
    // The only thing the application writes by itself: the mark of the session's opening.
    expect(Object.keys(sessionStorage).filter((key) => key !== "entana.launch-handled.v1")).toEqual(
      [],
    );
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/retrouver",
    );
    expect(document.body.innerHTML).not.toContain(SENT_BODY.orderCode.toLowerCase());
  });

  it("shows the delivery fee and the total of the order, as the tracking does", async () => {
    openFindOrder({ lookup: viewAnswer({ deliveryFeeAr: 1500, totalAr: 4700, itemCount: 2 }) });

    await fillAndSend();

    await screen.findByRole("button", { name: findOrder.refresh });
    expect(feeRowText()).toBe(`${texts.delivery.fee.label}${formatAmount(1500)}`);
    expect(document.body.textContent).toContain(itemsLine(2, 4700));
  });

  it("offers to order again once the order is finished", async () => {
    openFindOrder({
      lookup: viewAnswer({ status: "DELIVERED", canCancel: false, deliveryDate: "2026-10-02" }),
    });

    await fillAndSend();

    const reorder = await screen.findByRole("link", { name: texts.tracking.actions.reorder });
    expect(reorder.getAttribute("href")).toBe("/");
  });

  it("has no accessibility violation", async () => {
    openFindOrder({ lookup: viewAnswer({ status: "CONFIRMED" }) });
    await fillAndSend();
    await screen.findByRole("button", { name: findOrder.refresh });

    await expectNoAccessibilityViolations(document.body);
  });

  it("is read again once by a refresh, and keeps the last view when that fails", async () => {
    const app = openFindOrder({
      lookup: inSequence(viewAnswer({ status: "NEW" }), problemAnswer(500)),
    });
    await fillAndSend();

    fireEvent.click(await screen.findByRole("button", { name: findOrder.refresh }));

    expect(await screen.findByText(texts.tracking.refreshFailed)).toBeTruthy();
    expect(app.lookupCalls()).toHaveLength(2);
    expect(screen.getByRole("button", { name: findOrder.refresh })).toBeTruthy();
  });

  it("goes back to an empty form for another order", async () => {
    openFindOrder({ lookup: viewAnswer() });
    await fillAndSend();

    fireEvent.click(await screen.findByRole("button", { name: findOrder.another }));

    expect((await phoneInput()).value).toBe("");
    expect((await codeInput()).value).toBe("");
    expect(screen.queryByRole("button", { name: findOrder.refresh })).toBeNull();
  });
});
