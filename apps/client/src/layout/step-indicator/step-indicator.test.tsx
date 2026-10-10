import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { texts } from "../../i18n/texts";

import { StepIndicator } from "./step-indicator";

afterEach(cleanup);

describe("step indicator", () => {
  it("shows an icon in every step", () => {
    render(<StepIndicator />);

    const steps = screen.getByRole("navigation", { name: texts.shell.steps.label });
    for (const step of within(steps).getAllByRole("listitem")) {
      expect(step.querySelector("svg")).not.toBeNull();
    }
  });

  it("marks the given step as the current one and the steps before it as done", () => {
    render(<StepIndicator current={1} />);

    const steps = screen.getByRole("navigation", { name: texts.shell.steps.label });
    const current = steps.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain(texts.shell.steps.address);
    // Only the cart is behind the customer: it alone carries the "done" mark.
    const doneMarks = screen.getAllByText(texts.shell.steps.done);
    expect(doneMarks).toHaveLength(1);
    expect(doneMarks[0]?.closest("li")?.textContent).toContain(texts.shell.steps.cart);
  });

  it("never makes a done step a link", () => {
    render(<StepIndicator current={1} />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("says the position of the current step in the compact layout", () => {
    render(<StepIndicator current={1} isShownOnMobile mobileLayout="compact" />);

    expect(screen.getByText(texts.shell.steps.position(2, 5))).toBeTruthy();
  });
});
