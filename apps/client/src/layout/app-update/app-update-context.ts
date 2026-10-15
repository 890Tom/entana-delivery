import { createContext } from "react";

import type { AppUpdateStore } from "./app-update-store";

export interface AppUpdate {
  readonly store: AppUpdateStore;
  /** Activates the waiting version, then reloads the page. */
  readonly apply: () => void;
}

/** Null without a service worker (tests, or a browser without support): no notice. */
export const APP_UPDATE_CONTEXT = createContext<AppUpdate | null>(null);
