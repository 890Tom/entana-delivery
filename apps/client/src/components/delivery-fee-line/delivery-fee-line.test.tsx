import { formatAmount } from "@entana/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { texts } from "../../i18n/texts";

import { DeliveryFeeLine } from "./delivery-fee-line";

afterEach(cleanup);

describe("DeliveryFeeLine", () => {
  it("says the delivery is free when the fee is 0", () => {
    render(<DeliveryFeeLine amountAr={0} />);

    expect(screen.getByText(texts.delivery.fee.label)).toBeTruthy();
    expect(screen.getByText(texts.delivery.fee.free)).toBeTruthy();
  });

  it("shows the formatted amount when the fee is not 0", () => {
    render(<DeliveryFeeLine amountAr={2500} />);

    // The amount holds a no-break space, which the text matcher would normalise on one side only.
    expect(document.body.textContent).toContain(formatAmount(2500));
    expect(screen.queryByText(texts.delivery.fee.free)).toBeNull();
  });

  it("keeps its truck in the highlighted variant, and has no icon in the plain one", () => {
    const highlighted = render(<DeliveryFeeLine amountAr={0} />);
    expect(highlighted.container.querySelector("svg")).not.toBeNull();
    highlighted.unmount();

    const plain = render(<DeliveryFeeLine amountAr={0} variant="plain" />);

    expect(plain.container.querySelector("svg")).toBeNull();
    expect(screen.getByText(texts.delivery.fee.free)).toBeTruthy();
  });
});
