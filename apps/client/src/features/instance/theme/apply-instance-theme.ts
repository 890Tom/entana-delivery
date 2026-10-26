import type { InstanceTheme } from "./instance-theme-storage";
import { clearStoredTheme, readStoredTheme, writeStoredTheme } from "./instance-theme-storage";

// The ROLES of the design, not the palette: an inline variable on the document wins over the
// values of tokens.css and of theme.local.css. The action colour is the one the design calls
// "surface-inverse" (primary button, bottom bar, step and map marks) and its text is "text-inverse".
const ROLE_BY_FIELD: readonly (readonly [keyof InstanceTheme, string])[] = [
  ["accent", "--color-accent"],
  ["accentSoft", "--color-accent-soft"],
  ["accentStrong", "--color-accent-strong"],
  ["textOnAccent", "--color-text-on-accent"],
  ["action", "--color-surface-inverse"],
  ["actionHover", "--color-ink-hover"],
  ["textOnAction", "--color-text-inverse"],
];

function writeVariables(theme: InstanceTheme): void {
  for (const [field, role] of ROLE_BY_FIELD) {
    document.documentElement.style.setProperty(role, theme[field]);
  }
}

function removeVariables(): void {
  for (const [, role] of ROLE_BY_FIELD) {
    document.documentElement.style.removeProperty(role);
  }
}

/**
 * Applies the theme of the instance and keeps it on the device; no theme removes both. The theme
 * comes from the validated public instance, so its values are hex colours.
 */
export function applyInstanceTheme(theme: InstanceTheme | null): void {
  if (theme === null) {
    removeVariables();
    clearStoredTheme();
    return;
  }
  writeVariables(theme);
  writeStoredTheme(theme);
}

/** Before the first render: the theme kept on the device, if it is valid, so that nothing flashes. */
export function restoreStoredTheme(): void {
  const theme = readStoredTheme();
  if (theme !== null) {
    writeVariables(theme);
  }
}
