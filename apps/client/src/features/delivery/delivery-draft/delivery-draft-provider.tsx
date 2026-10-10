import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { GeoPoint } from "../map/map-adapter";

import { DELIVERY_DRAFT_CONTEXT } from "./delivery-draft-context";
import type { DeliveryDraftValue } from "./delivery-draft-context";
import {
  EMPTY_DRAFT,
  clearStoredDraft,
  readStoredDraft,
  serializeDraft,
  writeStoredDraft,
} from "./delivery-draft-storage";
import type { DeliveryDraft } from "./delivery-draft-storage";

/** Above the pages, so that the draft survives a visit to another screen, and a reload. */
export function DeliveryDraftProvider({ children }: { children: ReactNode }): ReactElement {
  const [initial] = useState<DeliveryDraft>(readStoredDraft);
  const [point, setPoint] = useState<GeoPoint | null>(initial.point);
  const [landmark, setLandmark] = useState(initial.landmark);
  // What the storage holds, so that an unchanged draft is not written again.
  const written = useRef(serializeDraft(initial));

  const draft = useMemo<DeliveryDraft>(() => ({ point, landmark }), [point, landmark]);
  const save = useMemo(
    () => (): void => {
      const content = serializeDraft(draft);
      if (content !== written.current) {
        written.current = content;
        writeStoredDraft(draft);
      }
    },
    [draft],
  );
  // A change is kept as it is made: a reload in the middle of the form loses nothing.
  useEffect(() => {
    save();
  }, [save]);

  const clear = useMemo(
    () => (): void => {
      // What the storage holds is "nothing": the change below must not write the empty draft back.
      written.current = serializeDraft(EMPTY_DRAFT);
      clearStoredDraft();
      setPoint(null);
      setLandmark("");
    },
    [],
  );

  const value = useMemo<DeliveryDraftValue>(
    () => ({ point, landmark, setPoint, setLandmark, save, clear }),
    [point, landmark, save, clear],
  );
  return <DELIVERY_DRAFT_CONTEXT value={value}>{children}</DELIVERY_DRAFT_CONTEXT>;
}
