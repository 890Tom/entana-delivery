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
});
