import type { TrackingLookupRequest, TrackingResponse } from "@entana/contracts";
import { useState } from "react";
import type { ReactElement } from "react";

import { texts } from "../../i18n/texts";
import { useDocumentTitle } from "../../layout/document-title/use-document-title";
import { useNoIndex } from "../tracking/use-no-index";

import { FindOrderForm } from "./find-order-form";
import { FindOrderResult } from "./find-order-result";

interface Found {
  readonly request: TrackingLookupRequest;
  readonly view: TrackingResponse;
}

/**
 * Finds an order again with the phone number and the order code. What was typed and what was
 * found live in the state of this component only: leaving the route, or asking for another
 * order, drops all of it.
 */
export function FindOrderScreen(): ReactElement {
  useDocumentTitle(texts.findOrder.title);
  useNoIndex();
  const [found, setFound] = useState<Found | null>(null);
  const [hasFound, setHasFound] = useState(false);
  if (found === null) {
    return (
      <FindOrderForm
        isReturning={hasFound}
        onFound={(request, view) => {
          setHasFound(true);
          setFound({ request, view });
        }}
      />
    );
  }
  return (
    <FindOrderResult
      request={found.request}
      initial={found.view}
      onAnother={() => {
        setFound(null);
      }}
    />
  );
}
