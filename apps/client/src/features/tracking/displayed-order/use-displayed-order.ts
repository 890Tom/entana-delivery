import { useEffect, useState } from "react";

import { TRACKING_PATH } from "../../../routes";
import { readConfirmedOrders } from "../../order-submission/storage/confirmed-orders-storage";

import { readTrackingToken } from "../rules/read-tracking-token";

/**
 * The order to show, and where it was found: a fragment is not yet remembered by the device. A
 * fragment that is not a token leads to no order at all: it never falls back on another one.
 */
export type DisplayedOrder =
  | { readonly token: string; readonly origin: "fragment" | "storage" }
  | { readonly origin: "invalid" };

// Pure: it reads the address and the storage and changes nothing, so that the double call of a
// strict-mode render gives the same answer. The address is cleaned in an effect.
function chooseOrder(): DisplayedOrder | null {
  const { hash } = window.location;
  if (hash.length > 1) {
    const token = readTrackingToken(hash);
    return token === null ? { origin: "invalid" } : { token, origin: "fragment" };
  }
  const latest = readConfirmedOrders(Date.now())[0];
  return latest === undefined ? null : { token: latest.token, origin: "storage" };
}

/**
 * The order of a tracking link, else (with no fragment at all) the most recent order of the device,
 * else none. Chosen once
 * per mount; the fragment, valid or not, is erased from the address bar at once.
 */
export function useDisplayedOrder(): DisplayedOrder | null {
  const [displayed] = useState(chooseOrder);
  useEffect(() => {
    if (window.location.hash !== "") {
      window.history.replaceState(window.history.state, "", TRACKING_PATH);
    }
  }, []);
  return displayed;
}
