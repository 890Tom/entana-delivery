import { useEffect } from "react";

import { useShopName } from "../../features/instance/api/use-instance";
import { texts } from "../../i18n/texts";

/** Titles the document "{screen} — {shop}". Set as text, so no markup can be interpreted. */
export function useDocumentTitle(screenTitle: string): void {
  const shopName = useShopName(texts.shell.genericName);
  const title = shopName === null ? screenTitle : `${screenTitle} — ${shopName}`;
  useEffect(() => {
    document.title = title;
  }, [title]);
}
