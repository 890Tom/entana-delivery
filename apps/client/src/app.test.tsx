import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./app";
import { createQueryClient } from "./query-client";
import { expectNoAccessibilityViolations } from "./test-support/expect-no-accessibility-violations";
import { jsonResponse, stubFetch } from "./test-support/stub-fetch";
import { texts } from "./texts";

function renderApp(): ReturnType<typeof render> {
  stubFetch(() => Promise.resolve(jsonResponse({ products: [] })));
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("shows the app name as the main heading", async () => {
    renderApp();

    expect(screen.getByRole("heading", { level: 1, name: texts.appTitle })).toBeTruthy();
    await screen.findByText(texts.catalogue.empty);
  });

  it("has no accessibility violation", async () => {
    const { container } = renderApp();
    await screen.findByText(texts.catalogue.empty);

    await expectNoAccessibilityViolations(container);
  });
});
