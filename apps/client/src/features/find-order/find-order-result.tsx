import type { TrackingLookupRequest, TrackingResponse } from "@entana/contracts";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "../../components/button/button";
import { texts } from "../../i18n/texts";
import { TrackingView, focusVisibleTitle } from "../tracking/content/tracking-content";

import { useLookup } from "./api/use-lookup";
import styles from "./find-order-screen.module.css";

/**
 * A refresh asks again with the same values, once, by hand; if it fails the last view stays,
 * marked as out of date.
 */
function useRefresh(
  request: TrackingLookupRequest,
  initial: TrackingResponse,
): {
  readonly view: TrackingResponse;
  readonly isStale: boolean;
  readonly isRefreshing: boolean;
  readonly refresh: () => void;
} {
  const lookup = useLookup();
  const [view, setView] = useState(initial);
  const [isStale, setIsStale] = useState(false);
  const refresh = (): void => {
    if (lookup.isPending) {
      return;
    }
    lookup.mutate(request, {
      onSuccess: (result) => {
        setIsStale(result.kind !== "ok");
        if (result.kind === "ok") {
          setView(result.view);
        }
      },
    });
  };
  return { view, isStale, isRefreshing: lookup.isPending, refresh };
}

interface FindOrderResultProps {
  readonly request: TrackingLookupRequest;
  readonly initial: TrackingResponse;
  readonly onAnother: () => void;
}

/**
 * The order, read only: no code, no cancellation, no link and nothing kept on the device, since
 * there is no token.
 */
export function FindOrderResult({
  request,
  initial,
  onAnother,
}: FindOrderResultProps): ReactElement {
  const { view, isStale, isRefreshing, refresh } = useRefresh(request, initial);
  const pageRef = useRef<HTMLDivElement>(null);
  // The form is gone: the focus goes to the title of the order, which says what was found.
  useEffect(() => {
    focusVisibleTitle(pageRef.current);
  }, []);
  return (
    <div ref={pageRef} className={styles.page}>
      <TrackingView
        view={view}
        isStale={isStale}
        onRetry={refresh}
        cancel={null}
        extras={
          <div className={styles.resultActions}>
            <Button isDisabled={isRefreshing} onClick={refresh}>
              {texts.findOrder.refresh}
            </Button>
            <Button variant="ghost" onClick={onAnother}>
              {texts.findOrder.another}
            </Button>
          </div>
        }
      />
    </div>
  );
}
