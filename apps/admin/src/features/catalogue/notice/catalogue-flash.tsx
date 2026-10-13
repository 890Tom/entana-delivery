import { createContext, use, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { CatalogueNotice } from "./catalogue-notice";

/**
 * The message that one screen of the catalogue leaves for the next one ("Mangue a été créé."). It
 * lives in memory only, not in the address nor in any storage: a reload does not repeat it.
 */
export interface CatalogueFlash {
  readonly post: (notice: CatalogueNotice) => void;
  /** Reads the message and forgets it: it is shown once. */
  readonly take: () => CatalogueNotice | null;
}

const NO_FLASH: CatalogueFlash = { post: () => undefined, take: () => null };

const FLASH_CONTEXT = createContext<CatalogueFlash>(NO_FLASH);

function createFlash(): CatalogueFlash {
  let pending: CatalogueNotice | null = null;
  return {
    post: (notice) => {
      pending = notice;
    },
    take: () => {
      const notice = pending;
      pending = null;
      return notice;
    },
  };
}

export function CatalogueFlashProvider({ children }: { children: ReactNode }): ReactElement {
  const [flash] = useState(createFlash);
  return <FLASH_CONTEXT value={flash}>{children}</FLASH_CONTEXT>;
}

export function useCatalogueFlash(): CatalogueFlash {
  return use(FLASH_CONTEXT);
}
