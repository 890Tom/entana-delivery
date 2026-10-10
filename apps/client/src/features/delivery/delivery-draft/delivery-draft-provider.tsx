import { useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { GeoPoint } from "../map/map-adapter";

import { DELIVERY_DRAFT_CONTEXT } from "./delivery-draft-context";
import type { DeliveryDraftValue } from "./delivery-draft-context";

/** Above the pages, so that the point survives a visit to another screen, and lost on reload. */
export function DeliveryDraftProvider({ children }: { children: ReactNode }): ReactElement {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const value = useMemo<DeliveryDraftValue>(() => ({ point, setPoint }), [point]);
  return <DELIVERY_DRAFT_CONTEXT value={value}>{children}</DELIVERY_DRAFT_CONTEXT>;
}
