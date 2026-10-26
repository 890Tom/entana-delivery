import { publicInstanceSchema } from "@entana/contracts";
import type { PublicInstance } from "@entana/contracts";

export type InstanceTheme = NonNullable<PublicInstance["theme"]>;

export const THEME_STORAGE_ITEM = "entana.theme.v1";

// The very schema of the public instance: a stored colour is checked as strictly as one received.
const THEME_SCHEMA = publicInstanceSchema.shape.theme.unwrap();

function parseTheme(stored: string): InstanceTheme | null {
  try {
    const parsed = THEME_SCHEMA.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * The theme kept on the device. Untrusted text: it is validated before use, and removed at the
 * first doubt. A storage that is blocked or unreadable gives no theme and no error.
 */
export function readStoredTheme(): InstanceTheme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_ITEM);
    if (stored === null) {
      return null;
    }
    const theme = parseTheme(stored);
    if (theme === null) {
      window.localStorage.removeItem(THEME_STORAGE_ITEM);
    }
    return theme;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: InstanceTheme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_ITEM, JSON.stringify(theme));
  } catch {
    // Private browsing or a full storage: the theme stays applied for this visit only.
  }
}

export function clearStoredTheme(): void {
  try {
    window.localStorage.removeItem(THEME_STORAGE_ITEM);
  } catch {
    // Blocked storage: nothing was kept that could be forgotten.
  }
}
