import { useLayoutEffect } from "react";
import type { RefObject } from "react";

/**
 * Publishes the real height of a fixed or sticky element as a custom property of the page, under
 * the name of the token that stands for it. The token is only the height the element has with
 * the content it usually holds: the element grows with its content (a name that wraps, a larger
 * text size, a question in place of a button), and what is placed relative to it (the sticky side
 * columns, the space kept free at the end of the page) must follow its real height.
 *
 * Nothing is published for an element that is not displayed, or that is part of the flow of the
 * page (`position: static`): the token's own value stays.
 */
export function useReportedHeight(
  ref: RefObject<HTMLElement | null>,
  property: string,
  /** False while the element is not in the page: it is then looked for again when it appears. */
  isPresent = true,
): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!isPresent || element === null) {
      return;
    }
    const root = document.documentElement;
    const report = (): void => {
      const height = element.getBoundingClientRect().height;
      const isOutOfFlow = getComputedStyle(element).position !== "static";
      if (height > 0 && isOutOfFlow) {
        root.style.setProperty(property, `${String(height)}px`);
      } else {
        root.style.removeProperty(property);
      }
    };
    report();
    // Where the browser cannot observe sizes the height is read once: the token's value is the
    // fallback for every later change.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(report);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(property);
    };
  }, [ref, property, isPresent]);
}
