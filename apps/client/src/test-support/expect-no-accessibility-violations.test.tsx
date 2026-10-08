import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { expectNoAccessibilityViolations } from "./expect-no-accessibility-violations";

afterEach(() => {
  cleanup();
});

async function auditOf(ui: ReactElement): Promise<string> {
  const { container } = render(ui);
  try {
    await expectNoAccessibilityViolations(container);
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "";
}

describe("expectNoAccessibilityViolations", () => {
  it("accepts an accessible page", async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <h2>Section</h2>
        <img src="a.png" alt="A product" />
        <label htmlFor="phone">Phone</label>
        <input id="phone" />
        <button type="button">Order</button>
      </main>,
    );

    await expect(expectNoAccessibilityViolations(container)).resolves.toBeUndefined();
  });

  it("reports an image without alternative text", async () => {
    expect(await auditOf(<img src="a.png" />)).toContain("image-alt");
  });

  it("reports a button without an accessible name", async () => {
    expect(await auditOf(<button type="button" />)).toContain("button-name");
  });

  it("reports an input without a label", async () => {
    expect(await auditOf(<input />)).toContain("label");
  });

  it("reports rule id, impact and selector, never the HTML", async () => {
    const message = await auditOf(<img src="a.png" />);

    expect(message).toMatch(/image-alt \(critical\): img/);
    expect(message).not.toContain("<img");
  });

  it("reports a skipped heading level", async () => {
    expect(
      await auditOf(
        <main>
          <h1>Title</h1>
          <h3>Skipped</h3>
        </main>,
      ),
    ).toContain("heading-order");
  });

  it("does not require page-level landmarks from a component", async () => {
    expect(await auditOf(<h1>Title</h1>)).toBe("");
  });
});
