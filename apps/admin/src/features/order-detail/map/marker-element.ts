import { ICON_PATHS } from "../../orders/components/order-icons";

import styles from "./marker.module.css";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createHouse(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", styles.house ?? "");
  for (const definition of ICON_PATHS.house) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", definition);
    svg.append(path);
  }
  return svg;
}

/** The delivery marker: a disc with a house and a tail whose tip is the point. Not a control. */
export function createMarkerElement(label: string): HTMLElement {
  const element = document.createElement("div");
  element.className = styles.marker ?? "";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", label);
  const disc = document.createElement("div");
  disc.className = styles.disc ?? "";
  disc.append(createHouse());
  const tail = document.createElement("div");
  tail.className = styles.tail ?? "";
  element.append(disc, tail);
  return element;
}
