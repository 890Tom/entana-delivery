import { describe, expect, it } from "vitest";

// Read as text by Vite, so that the test needs no Node module (front ends import none).
const stylesheets = import.meta.glob<string>("./*.css", {
  query: "?raw",
  import: "default",
  eager: true,
});
const noticeStylesheets = import.meta.glob<string>("../components/notice/notice.module.css", {
  query: "?raw",
  import: "default",
  eager: true,
});
const accentTextStylesheets = import.meta.glob<string>(
  [
    "../layout/header/cart-badge.module.css",
    "../layout/step-indicator/step-indicator.module.css",
    "../features/resellers/map/shop-marker.module.css",
    "../components/button/button.module.css",
  ],
  { query: "?raw", import: "default", eager: true },
);
// Git-ignored and absent on a fresh clone: the glob is then empty.
const privateThemes = import.meta.glob<string>("../../public/theme.local.css", {
  query: "?raw",
  import: "default",
  eager: true,
});

const COMMENT = /\/\*[\s\S]*?\*\//g;
const HEX_COLOUR = /#[0-9a-fA-F]{3,8}\b/;
// Names that belong to the original design system and must not leak into the repository.
const FORBIDDEN_NAMES = ["gold", "google", "gray-", "--white", "--black"];

function withoutComments(css: string): string {
  return css.replace(COMMENT, "");
}

function stylesheet(name: string): string {
  const css = stylesheets[`./${name}`];
  if (css === undefined) {
    throw new Error(`${name} is missing`);
  }
  return withoutComments(css);
}

function definedVariables(css: string): Set<string> {
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1] ?? ""));
}

function usedVariables(css: string): Set<string> {
  return new Set([...css.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1] ?? ""));
}

function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return start === -1 ? "" : css.slice(start, css.indexOf("}", start));
}

describe("the success notice", () => {
  const success = ruleBody(
    withoutComments(noticeStylesheets["../components/notice/notice.module.css"] ?? ""),
    ".success",
  );

  it("is painted with the success roles only", () => {
    expect([...usedVariables(success)].sort()).toEqual([
      "--color-success",
      "--color-text-on-success",
    ]);
  });
});

// The text colour of a rule: `color`, and not `background-color` or `border-color`.
function textColourOf(css: string, selector: string): string | undefined {
  return /(?<![-\w])color:\s*var\((--[\w-]+)\)/.exec(ruleBody(css, selector))?.[1];
}

describe("the text set on the accent", () => {
  it.each([
    ["../layout/header/cart-badge.module.css", ".count"],
    ["../layout/step-indicator/step-indicator.module.css", ".current .step"],
    ["../features/resellers/map/shop-marker.module.css", ".selected"],
    ["../components/button/button.module.css", '.accent:hover:not([aria-disabled="true"])'],
  ])("reads --color-text-on-accent in %s, rule %s", (file, selector) => {
    const css = withoutComments(accentTextStylesheets[file] ?? "");

    expect(textColourOf(css, selector)).toBe("--color-text-on-accent");
  });
});

describe("the stylesheets", () => {
  it("only use variables that tokens.css defines", () => {
    const defined = definedVariables(stylesheet("tokens.css"));

    for (const name of Object.keys(stylesheets)) {
      const undefinedVariables = [...usedVariables(stylesheet(name.slice(2)))].filter(
        (variable) => !defined.has(variable),
      );
      expect(undefinedVariables, name).toEqual([]);
    }
  });

  it("keep the original design system names out of tokens.css", () => {
    const tokens = (stylesheets["./tokens.css"] ?? "").toLowerCase();

    expect(FORBIDDEN_NAMES.filter((name) => tokens.includes(name))).toEqual([]);
  });

  it("write a colour literal only in tokens.css", () => {
    const withLiteral = Object.keys(stylesheets).filter(
      (name) => name !== "./tokens.css" && HEX_COLOUR.test(stylesheet(name.slice(2))),
    );

    expect(withLiteral).toEqual([]);
  });

  it("let a private theme redefine only variables that tokens.css defines", () => {
    const defined = definedVariables(stylesheet("tokens.css"));

    for (const css of Object.values(privateThemes)) {
      const unknown = [...definedVariables(withoutComments(css))].filter(
        (variable) => !defined.has(variable),
      );
      expect(unknown).toEqual([]);
    }
  });
});
