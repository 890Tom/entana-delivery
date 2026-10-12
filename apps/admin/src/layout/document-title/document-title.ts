import { useEffect } from "react";

import { useShopName } from "../../features/instance/hooks/use-instance";
import { texts } from "../../i18n/texts";

/** Titles the document "Administration — {shop}", set as text so no markup is interpreted. */
export function useDocumentTitle(): void {
  const shopName = useShopName();
  const title = shopName === null ? texts.document.title : texts.document.titleWithShop(shopName);
  useEffect(() => {
    document.title = title;
  }, [title]);
}
