import { createContext, useContext } from "react";

export interface LaunchValue {
  /** The opening of the application is being checked: the catalogue keeps its loading state. */
  readonly isHolding: boolean;
}

// Without a provider (a screen shown alone) nothing is held.
export const LAUNCH_CONTEXT = createContext<LaunchValue>({ isHolding: false });

export function useLaunch(): LaunchValue {
  return useContext(LAUNCH_CONTEXT);
}
