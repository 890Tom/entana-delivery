import { useEffect, useState } from "react";

import { useCatalogueFlash } from "./catalogue-flash";
import type { CatalogueNotice } from "./catalogue-notice";

export type { CatalogueNotice } from "./catalogue-notice";

export interface NoticeState {
  readonly notice: CatalogueNotice | null;
  readonly show: (notice: CatalogueNotice) => void;
  readonly clear: () => void;
}

const INFO_DURATION_MS = 6000;

/**
 * The one message of the screen. An information goes away by itself after 6 seconds; an error
 * stays until the next action. Both go away at the next action. A message left by the previous
 * screen is taken on arrival.
 */
export function useCatalogueNotice(): NoticeState {
  const [notice, setNotice] = useState<CatalogueNotice | null>(null);
  const flash = useCatalogueFlash();
  // What the previous screen left (a product created, a photo that failed) is shown on arrival.
  useEffect(() => {
    const left = flash.take();
    if (left !== null) {
      setNotice(left);
    }
  }, [flash]);
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
