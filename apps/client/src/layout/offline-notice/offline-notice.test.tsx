import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { OfflineNotice } from "./offline-notice";

let isOnline = true;

function goOffline(): void {
  isOnline = false;
  act(() => {
    window.dispatchEvent(new Event("offline"));
  });
}

function goOnline(): void {
  isOnline = true;
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
}

beforeEach(() => {
  isOnline = true;
  vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => isOnline);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the offline notice", () => {
  it("stays hidden while the browser is online", () => {
    render(<OfflineNotice />);

    expect(screen.queryByText(texts.connection.offline)).toBeNull();
  });

  it("appears in a polite live region when the browser goes offline", () => {
    const { container } = render(<OfflineNotice />);
    const region = container.firstElementChild;

    goOffline();

    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("aria-atomic")).toBe("true");
    expect(region?.textContent).toContain(texts.connection.offline);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disappears as soon as the browser is back online", () => {
    render(<OfflineNotice />);
    goOffline();

    goOnline();

    expect(screen.queryByText(texts.connection.offline)).toBeNull();
  });
});
