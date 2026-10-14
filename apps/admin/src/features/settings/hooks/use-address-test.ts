import type { DeliveryResolveResponse, GeoPoint } from "@entana/contracts";
import { useRef, useState } from "react";

import { resolvePoint } from "../api/axes-calls";

export type AddressTestState =
  | { readonly kind: "idle" }
  | { readonly kind: "pending" }
  | { readonly kind: "done"; readonly result: DeliveryResolveResponse }
  | { readonly kind: "failed" };

export interface AddressTest {
  /** The point tested last, where the map shows its marker; null before the first click. */
  readonly point: GeoPoint | null;
  readonly state: AddressTestState;
  readonly run: (point: GeoPoint) => void;
}

/**
 * Asks the server what a point of the map gets. The last click wins: the answer of an older one
 * is ignored. A refused session reads the axes again, which leads to the sign-in.
 */
export function useAddressTest(onUnauthorized: () => void): AddressTest {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [state, setState] = useState<AddressTestState>({ kind: "idle" });
  const lastRequest = useRef(0);

  const run = (clicked: GeoPoint): void => {
    lastRequest.current += 1;
    const request = lastRequest.current;
    setPoint(clicked);
    setState({ kind: "pending" });
    void resolvePoint(clicked).then((result) => {
      if (request !== lastRequest.current) {
        return;
      }
      if (result.kind === "ok") {
        setState({ kind: "done", result: result.data });
        return;
      }
      if (result.kind === "unauthorized") {
        onUnauthorized();
      }
      setState({ kind: "failed" });
    });
  };
  return { point, state, run };
}
