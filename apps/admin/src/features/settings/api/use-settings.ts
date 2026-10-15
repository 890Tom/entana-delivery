import type { DeliverySettings } from "@entana/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchSettings } from "./settings-calls";

const SETTINGS_KEY = ["admin-delivery-settings"] as const;

export interface SettingsModel {
  /** Undefined until the settings are loaded. */
  readonly settings: DeliverySettings | undefined;
  readonly hasFailed: boolean;
  readonly retry: () => void;
}

/** The delivery settings, held in the query cache: both tabs read the same copy. */
export function useSettings(): SettingsModel {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: ({ signal }) => fetchSettings(signal),
  });
  return {
    settings: query.data,
    hasFailed: query.isError,
    retry: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  };
}

export interface SettingsCache {
  /** Puts the server's version of the settings in memory. */
  readonly replace: (settings: DeliverySettings) => void;
  /** Marks the settings as old: they are read again (a refused session then shows the sign-in). */
  readonly invalidate: () => void;
}

export function useSettingsCache(): SettingsCache {
  const queryClient = useQueryClient();
  return {
    replace: (settings) => {
      queryClient.setQueryData(SETTINGS_KEY, settings);
    },
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  };
}
