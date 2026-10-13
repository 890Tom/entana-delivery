import { ICON_PATHS } from "../../../components/icon/icon";

import styles from "./shop-marker.module.css";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createStoreIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", styles.icon ?? "");
  for (const definition of ICON_PATHS.store) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", definition);
    svg.append(path);
  }
  return svg;
}

/**
 * The marker of a reseller: a round button, focusable, named by the reseller. The name is set as
 * text (never as markup).
 */
export function createShopMarkerElement(name: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = styles.marker ?? "";
  button.title = name;
  button.setAttribute("aria-label", name);
  button.setAttribute("aria-pressed", "false");
  button.append(createStoreIcon());
  return button;
}

/** Enlarges and raises the marker of the selected reseller; the state is also read as text. */
export function markShopMarkerSelected(element: HTMLButtonElement, isSelected: boolean): void {
  element.classList.toggle(styles.selected ?? "", isSelected);
  element.setAttribute("aria-pressed", isSelected ? "true" : "false");
}

/** The dot of the customer's position: not interactive, named for assistive technology. */
export function createUserDotElement(label: string): HTMLElement {
  const dot = document.createElement("div");
  dot.className = styles.userDot ?? "";
  dot.setAttribute("role", "img");
  dot.setAttribute("aria-label", label);
  return dot;
}
