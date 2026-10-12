import { useEffect, useState } from "react";

export interface CatalogueNotice {
  readonly tone: "info" | "error";
  readonly text: string;
}

export interface NoticeState {
  readonly notice: CatalogueNotice | null;
  readonly show: (notice: CatalogueNotice) => void;
  readonly clear: () => void;
}

const INFO_DURATION_MS = 6000;

/**
 * The one message of the screen. An information goes away by itself after 6 seconds; an error
 * stays until the next action. Both go away at the next action.
 */
export function useCatalogueNotice(): NoticeState {
  const [notice, setNotice] = useState<CatalogueNotice | null>(null);
  useEffect(() => {
    if (notice?.tone !== "info") {
      return undefined;
    }
    const timer = setTimeout(() => {
      setNotice(null);
    }, INFO_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);
  return {
    notice,
    show: setNotice,
    clear: () => {
      setNotice(null);
    },
  };
}
