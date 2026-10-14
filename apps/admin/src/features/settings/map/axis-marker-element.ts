import { badgeTextTone } from "../rules/badge-tone";

import styles from "./axis-marker.module.css";

/**
 * The marker of a place of the axis being edited: its number on a badge of the axis colour, the
 * name beside it. The badge is the element, so that its centre is the place. Not a control; the
 * list beside the map says the same.
 */
export function createAxisMarkerElement(rank: number, name: string, color: string): HTMLElement {
  const badge = document.createElement("div");
  badge.className = [styles.badge, styles[badgeTextTone(color)]].join(" ");
  badge.setAttribute("aria-hidden", "true");
  // The colour is data of the axis, chosen by the shop: it cannot be a design token.
  badge.style.backgroundColor = color;
  badge.textContent = String(rank);
  const label = document.createElement("span");
  label.className = styles.label ?? "";
  label.textContent = name;
  badge.append(label);
  return badge;
}
