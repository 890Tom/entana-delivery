import { formatAmount } from "@entana/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import {
  buildDeliveryQuote,
  buildOutOfAxisQuote,
} from "../../test-support/builders/build-delivery-quote";

import { DeliveryFeeLine } from "./delivery-fee-line";

afterEach(cleanup);

const { fee } = texts.delivery;
// The texts hold no-break spaces, which a text matcher would normalise on one side only: the
// text content of the page is compared instead.

describe("DeliveryFeeLine", () => {
  it("names the place found inside an axis, free, with no note", () => {
    render(
      <DeliveryFeeLine
        state={{ status: "ready", quote: buildDeliveryQuote({ placeName: "Ambohidemo" }) }}
      />,
    );

    expect(document.body.textContent).toContain(fee.zone("Ambohidemo"));
    expect(screen.getByText(fee.free)).toBeTruthy();
    expect(document.body.textContent).not.toContain(fee.freeFrom(10));
  });

  it("says the delivery is free for the quantity, and from how many pieces", () => {
    render(
      <DeliveryFeeLine
        state={{
          status: "ready",
          quote: buildDeliveryQuote({
            reason: "quantity",
            placeName: null,
            freeDeliveryMinPieces: 12,
          }),
        }}
      />,
    );

    expect(screen.getByText(fee.label)).toBeTruthy();
    expect(screen.getByText(fee.free)).toBeTruthy();
    expect(document.body.textContent).toContain(fee.freeFrom(12));
  });

  it("shows the server's message out of the axes, the formatted amount and the note", () => {
    render(
      <DeliveryFeeLine state={{ status: "ready", quote: buildOutOfAxisQuote({ feeAr: 2500 }) }} />,
    );

    expect(screen.getByText("Hors zone démo")).toBeTruthy();
    expect(document.body.textContent).toContain(formatAmount(2500));
    expect(document.body.textContent).toContain(fee.freeFrom(10));
  });

  it.each([
    ["a place name", buildDeliveryQuote({ placeName: null })],
    ["an out-of-axis message", buildOutOfAxisQuote({ outOfAxisMessage: null })],
  ])("says Livraison when the server gives no %s", (_label, quote) => {
    render(<DeliveryFeeLine state={{ status: "ready", quote }} />);

    expect(screen.getByText(fee.label)).toBeTruthy();
  });

  it("shows the server's text as text, never as markup", () => {
    const { container } = render(
      <DeliveryFeeLine
        state={{ status: "ready", quote: buildOutOfAxisQuote({ outOfAxisMessage: "<b>Hors</b>" }) }}
      />,
    );

    expect(screen.getByText("<b>Hors</b>")).toBeTruthy();
    expect(container.querySelector("b")).toBeNull();
  });

  it("is a busy skeleton while the fee is computed, with no amount", () => {
    const { container } = render(<DeliveryFeeLine state={{ status: "loading" }} />);

    expect(container.querySelector('[aria-busy="true"]')?.textContent).toBe(texts.common.loading);
    expect(container.textContent).not.toContain(fee.free);
  });

  it("says the fee could not be computed, with a retry the keyboard reaches", () => {
    const onRetry = vi.fn();
    render(<DeliveryFeeLine state={{ status: "failed", onRetry }} />);

    expect(screen.getByText(fee.failed)).toBeTruthy();
    const retry = screen.getByRole("button", { name: texts.common.retry });
    retry.focus();
    expect(document.activeElement).toBe(retry);
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("keeps its truck in the highlighted variant, and has no icon in the plain one", () => {
    const state = { status: "ready", quote: buildDeliveryQuote() } as const;
    const highlighted = render(<DeliveryFeeLine state={state} />);
    expect(highlighted.container.querySelector("svg")).not.toBeNull();
    highlighted.unmount();

    const plain = render(<DeliveryFeeLine state={state} variant="plain" />);

    expect(plain.container.querySelector("svg")).toBeNull();
  });
});
