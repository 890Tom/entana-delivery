import axe from "axe-core";

// "best-practice" is added because the heading-order rule carries it, not a WCAG tag.
const AUDITED_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

function describeViolation(violation: axe.Result): string {
  const selectors = violation.nodes.map((node) => node.target.join(" ")).join(", ");
  return `${violation.id} (${String(violation.impact)}): ${selectors}`;
}

/**
 * Runs axe on a rendered container and throws if a WCAG 2.1 A or AA rule is violated.
 * The message lists rule id, impact and selectors only, never the HTML.
 */
export async function expectNoAccessibilityViolations(container: Element): Promise<void> {
  const { violations } = await axe.run(container, {
    runOnly: { type: "tag", values: AUDITED_TAGS },
    rules: {
      // jsdom does no layout and no painting, so colour contrast cannot be computed: it must be
      // checked in a real browser.
      "color-contrast": { enabled: false },
      // Page-level: a component test renders a fragment, which never holds the page's one main.
      "landmark-one-main": { enabled: false },
      // Page-level: a fragment is not a page whose content must sit inside landmarks.
      region: { enabled: false },
      // Page-level: a fragment has no obligation to hold the page's h1.
      "page-has-heading-one": { enabled: false },
    },
  });
  if (violations.length > 0) {
    throw new Error(
      `${String(violations.length)} accessibility violation(s):\n${violations.map(describeViolation).join("\n")}`,
    );
  }
}
