import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../../../app";
import { createQueryClient } from "../../../data-fetching/query-client";
import { texts } from "../../../i18n/texts";
import { CATALOGUE_PATH, RESELLERS_PATH } from "../../../routes";
import { buildInstance } from "../../../test-support/builders/build-instance";
import { jsonResponse } from "../../../test-support/stubs/stub-fetch";

function openAt(path: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        input === "/api/v1/instance"
          ? jsonResponse(buildInstance())
          : jsonResponse({ products: [], resellers: [] }),
      ),
    ),
  );
  window.history.pushState({}, "", path);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <App />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the ways to the resellers screen", () => {
  it("is a link of the header and a row above the catalogue title", async () => {
    openAt(CATALOGUE_PATH);
    const heading = await screen.findByRole("heading", { level: 1 });

    const links = screen.getAllByRole("link", { name: texts.resellers.title });

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      RESELLERS_PATH,
      RESELLERS_PATH,
    ]);
    const row = links.find((link) => link.closest("header") === null);
    expect(row?.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("has a way back to the catalogue on the screen itself", async () => {
    openAt(RESELLERS_PATH);
    await screen.findByRole("heading", { level: 1, name: texts.resellers.title });

    const back = screen.getByRole("link", { name: texts.shell.back });

    expect(back.getAttribute("href")).toBe(CATALOGUE_PATH);
  });
});
