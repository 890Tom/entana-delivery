import type { PublicInstance } from "@entana/contracts";

type InstanceTheme = NonNullable<PublicInstance["theme"]>;

/** A valid theme, with neutral colours that belong to no shop. */
export function buildInstanceTheme(overrides: Partial<InstanceTheme> = {}): InstanceTheme {
  return {
    accent: "#2d6cdf",
    accentSoft: "#e0e9fa",
    accentStrong: "#2961c9",
    textOnAccent: "#ffffff",
    action: "#2b2b2b",
    actionHover: "#555555",
    textOnAction: "#ffffff",
    ...overrides,
  };
}
