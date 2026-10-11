import type { ReactElement } from "react";

import { Notice } from "../../components/notice/notice";
import { texts } from "../../i18n/texts";
import { TRACKING_PATH } from "../../routes";

import { useActiveOrder, useLatestOrder } from "./api/use-active-order";

/**
 * Above the products while the latest order of the device is still going on. It says nothing
 * while the check is on its way, and nothing when the check fails.
 */
export function ActiveOrderNotice(): ReactElement | null {
  const check = useActiveOrder(useLatestOrder());
  if (check.data?.isActive !== true) {
    return null;
  }
  const { activeOrder } = texts.catalogue;
  return (
    <Notice tone="info" action={{ label: activeOrder.action, href: TRACKING_PATH }}>
      {activeOrder.text}
    </Notice>
  );
}
