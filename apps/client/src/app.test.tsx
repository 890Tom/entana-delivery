import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "./app";
import { expectNoAccessibilityViolations } from "./test-support/expect-no-accessibility-violations";

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("shows the app name as the main heading", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Entana Delivery" })).toBeTruthy();
  });

  it("renders nothing but the heading", () => {
    const { container } = render(<App />);

    expect(container.innerHTML).toBe("<h1>Entana Delivery</h1>");
  });

  it("has no accessibility violation", async () => {
    const { container } = render(<App />);

    await expectNoAccessibilityViolations(container);
  });
});
