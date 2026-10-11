import { act, cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useReportedHeight } from "./use-reported-height";

const PROPERTY = "--size-test-height";

let observed: (() => void) | undefined;

class FakeResizeObserver {
  constructor(callback: () => void) {
    observed = callback;
  }
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();
}

function Probe({ position = "sticky" }: { position?: "sticky" | "static" }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useReportedHeight(ref, PROPERTY);
  return <div ref={ref} style={{ position }} />;
}

function stubHeight(height: number): void {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    height,
  } as DOMRect);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  observed = undefined;
});

describe("reporting the real height of a fixed element", () => {
  it("publishes it, follows its changes, and gives the token back when the element is gone", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    stubHeight(60);
    const { unmount } = render(<Probe />);
    expect(document.documentElement.style.getPropertyValue(PROPERTY)).toBe("60px");

    stubHeight(96);
    act(() => {
      observed?.();
    });
    expect(document.documentElement.style.getPropertyValue(PROPERTY)).toBe("96px");

    unmount();
    expect(document.documentElement.style.getPropertyValue(PROPERTY)).toBe("");
  });

  it("publishes nothing for an element that is not displayed or is in the flow of the page", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    stubHeight(0);
    render(<Probe />);
    expect(document.documentElement.style.getPropertyValue(PROPERTY)).toBe("");
    cleanup();

    stubHeight(80);
    render(<Probe position="static" />);
    expect(document.documentElement.style.getPropertyValue(PROPERTY)).toBe("");
  });
});
