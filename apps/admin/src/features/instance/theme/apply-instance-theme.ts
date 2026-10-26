import { publicInstanceSchema } from "@entana/contracts";
import type { PublicInstance } from "@entana/contracts";

type InstanceTheme = NonNullable<PublicInstance["theme"]>;

// The very schema of the public instance: a colour is strict hex before it is written.
const THEME_SCHEMA = publicInstanceSchema.shape.theme.unwrap();

// The ROLES of the design, not the palette: an inline variable on the document wins over the
// values of tokens.css and of theme.local.css. The action colour is the one the design calls
// "surface-inverse" (buttons, dark status pills, map pin) and its text is "text-inverse".
const ROLE_BY_FIELD: readonly (readonly [keyof InstanceTheme, string])[] = [
  ["accent", "--color-accent"],
  ["accentSoft", "--color-accent-soft"],
  ["accentStrong", "--color-accent-strong"],
  ["textOnAccent", "--color-text-on-accent"],
  ["action", "--color-surface-inverse"],
  ["actionHover", "--color-ink-hover"],
  ["textOnAction", "--color-text-inverse"],
];

/**
 * Applies the theme of the instance to the document; no theme removes the colours it wrote. A
 * theme that is not made of hex colours is ignored: nothing invalid is ever written.
 */
export function applyInstanceTheme(theme: unknown): void {
  const style = document.documentElement.style;
  if (theme === null) {
    for (const [, role] of ROLE_BY_FIELD) {
      style.removeProperty(role);
    }
    return;
  }
  const parsed = THEME_SCHEMA.safeParse(theme);
  if (!parsed.success) {
    return;
  }
  for (const [field, role] of ROLE_BY_FIELD) {
    style.setProperty(role, parsed.data[field]);
  }
}
