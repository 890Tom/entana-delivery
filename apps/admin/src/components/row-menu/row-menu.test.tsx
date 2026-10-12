import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RowMenu } from "./row-menu";

afterEach(cleanup);

function renderMenu(onSelect = vi.fn()): { onSelect: () => void } {
  render(
    <>
      <RowMenu
        label="Actions"
        icon={<span>…</span>}
        items={[
          { key: "first", label: "Premier", tone: "normal", onSelect },
          { key: "second", label: "Second", tone: "danger", onSelect: vi.fn() },
          { key: "third", label: "Troisième", tone: "normal", onSelect: vi.fn() },
        ]}
      />
      <button type="button">Ailleurs</button>
    </>,
  );
  return { onSelect };
}

const opener = (): HTMLElement => screen.getByRole("button", { name: "Actions" });

describe("the row menu", () => {
  it("opens on the first entry and moves with the arrows, Home and End", () => {
    renderMenu();

    fireEvent.click(opener());
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Premier" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Second" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Troisième" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Premier" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Troisième" }));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Premier" }));
  });

  it("closes with Escape and gives the focus back to its button", () => {
    renderMenu();

    fireEvent.click(opener());
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it("closes with Tab, and with a pointer outside", () => {
    renderMenu();

    fireEvent.click(opener());
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(opener());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Ailleurs" }));

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("runs the chosen entry and closes", () => {
    const { onSelect } = renderMenu();

    fireEvent.click(opener());
    fireEvent.click(screen.getByRole("menuitem", { name: "Premier" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
