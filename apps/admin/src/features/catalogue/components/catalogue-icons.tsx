import type { ReactElement } from "react";

export type CatalogueIconName =
  | "grip"
  | "image"
  | "ellipsis"
  | "pause-circle"
  | "plus"
  | "lock"
  | "archive"
  | "image-plus"
  | "image-up";

type Shape =
  | { readonly kind: "path"; readonly d: string }
  | { readonly kind: "dot"; readonly x: number; readonly y: number };

const dot = (x: number, y: number): Shape => ({ kind: "dot", x, y });
const path = (d: string): Shape => ({ kind: "path", d });

// Simple line icons drawn from the owner's capture (no request, no package). Decorative: the
// text or the accessible name beside them says the same. To confirm with the owner's icon set.
const SHAPES: Readonly<Record<CatalogueIconName, readonly Shape[]>> = {
  grip: [dot(9, 5), dot(15, 5), dot(9, 12), dot(15, 12), dot(9, 19), dot(15, 19)],
  image: [
    path("M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"),
    path("m21 15-5-5L5 21"),
    path("M9 8.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z"),
  ],
  ellipsis: [dot(5, 12), dot(12, 12), dot(19, 12)],
  "pause-circle": [
    path("M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"),
    path("M10 15V9"),
    path("M14 15V9"),
  ],
  plus: [path("M5 12h14"), path("M12 5v14")],
  lock: [
    path("M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z"),
    path("M7 11V7a5 5 0 0 1 10 0v4"),
  ],
  archive: [
    path("M3 4h18a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"),
    path("M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"),
    path("M10 12h4"),
  ],
  "image-plus": [
    path("M16 5h6"),
    path("M19 2v6"),
    path("M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"),
    path("m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"),
    path("M9 8.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z"),
  ],
  "image-up": [
    path(
      "M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21",
    ),
    path("m14 19.5 3-3 3 3"),
    path("M17 22v-5.5"),
    path("M9 8.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z"),
  ],
};

/** Dots are filled; paths are stroked. */
export function CatalogueIcon({
  name,
  size,
}: {
  name: CatalogueIconName;
  size: number;
}): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[name].map((shape) =>
        shape.kind === "dot" ? (
          <circle
            key={`${String(shape.x)}-${String(shape.y)}`}
            cx={shape.x}
            cy={shape.y}
            r="1.5"
            fill="currentColor"
          />
        ) : (
          <path key={shape.d} d={shape.d} />
        ),
      )}
    </svg>
  );
}
