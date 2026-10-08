import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { expectNoAccessibilityViolations } from "./test-support/expect-no-accessibility-violations";

// Documents the pattern every component follows for text that comes from a customer or from the
// server: put it in `{value}`, and React escapes it. This tests the pattern on a local component,
// not the real components: each of those needs its own test with untrusted text.
function UntrustedText({ value }: { value: string }): ReactElement {
  return <p>{value}</p>;
}

const SCRIPT_TEXT = "<script>alert(1)</script>";
const IMAGE_TEXT = '<img src="x" onerror="alert(1)">';
const LINK_TEXT = "javascript:alert(1)";

afterEach(() => {
  cleanup();
});

describe("untrusted text", () => {
  it.each([
    ["a script tag", SCRIPT_TEXT],
    ["an image with an onerror handler", IMAGE_TEXT],
    ["a javascript: link", LINK_TEXT],
  ])("shows %s as plain text", (_label, value) => {
    const { container } = render(<UntrustedText value={value} />);

    expect(container.textContent).toBe(value);
  });

  it("creates no script, image or link element from markup in the text", () => {
    const value = `${SCRIPT_TEXT} ${IMAGE_TEXT} <a href="${LINK_TEXT}">${LINK_TEXT}</a>`;

    const { container } = render(<UntrustedText value={value} />);

    expect(container.querySelectorAll("script, img, a, [onerror]")).toHaveLength(0);
    expect(container.children).toHaveLength(1);
  });

  it("has no accessibility violation", async () => {
    const { container } = render(
      <UntrustedText value={`${SCRIPT_TEXT} ${IMAGE_TEXT} ${LINK_TEXT}`} />,
    );

    await expectNoAccessibilityViolations(container);
  });
});
