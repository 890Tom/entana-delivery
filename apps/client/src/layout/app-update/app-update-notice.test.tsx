import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { texts } from "../../i18n/texts";
import { APP_UPDATE_CONTEXT } from "./app-update-context";
import { AppUpdateNotice } from "./app-update-notice";
import { createAppUpdateStore } from "./app-update-store";

const t = texts.appUpdate;

function renderNotice(): { markWaiting: () => void; apply: () => void } {
  const store = createAppUpdateStore();
  const apply = vi.fn();
  render(
    <APP_UPDATE_CONTEXT value={{ store, apply }}>
      <AppUpdateNotice />
    </APP_UPDATE_CONTEXT>,
  );
  return { markWaiting: store.markWaiting, apply };
}

afterEach(() => {
  cleanup();
});

describe("the new version notice", () => {
  it("stays hidden while no new version is waiting", () => {
    renderNotice();

    expect(screen.queryByText(t.message)).toBeNull();
  });

  it("appears in a live region when a new version is waiting", () => {
    const { markWaiting } = renderNotice();

    act(markWaiting);

    expect(screen.getByRole("status").textContent).toContain(t.message);
  });

  it("applies the update when the customer asks for it", () => {
    const { markWaiting, apply } = renderNotice();
    act(markWaiting);

    fireEvent.click(screen.getByRole("button", { name: t.apply }));

    expect(apply).toHaveBeenCalledOnce();
  });

  it("hides itself without updating when the customer chooses later", () => {
    const { markWaiting, apply } = renderNotice();
    act(markWaiting);

    fireEvent.click(screen.getByRole("button", { name: t.later }));

    expect(screen.queryByText(t.message)).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it("renders nothing in an application without a service worker", () => {
    const { container } = render(<AppUpdateNotice />);

    expect(container.childElementCount).toBe(0);
  });
});
