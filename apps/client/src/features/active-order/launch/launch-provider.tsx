import { useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useLocation } from "wouter";

import { CATALOGUE_PATH, TRACKING_PATH } from "../../../routes";
import { useCart } from "../../cart/cart-state/cart-context";
import { useActiveOrder, useLatestOrder } from "../api/use-active-order";
import { shouldCheckLaunch } from "../rules/decide-launch";
import { isLaunchHandled, markLaunchHandled } from "../storage/launch-flag";

import { LAUNCH_CONTEXT } from "./launch-context";
import type { LaunchValue } from "./launch-context";

/** How long the catalogue waits for the check before it is shown as it is. */
export const LAUNCH_CHECK_TIMEOUT_MS = 2000;

/** The check of the opening is asked for once, from facts known at the first render. */
function useIsLaunchChecked(hasOrder: boolean): boolean {
  const { itemCount } = useCart();
  // Decided in the initialiser and written in an effect: a render must not write, and a second
  // render (strict mode) would otherwise see the flag the first one set.
  const [isChecked] = useState(() =>
    shouldCheckLaunch({
      isHandled: isLaunchHandled(),
      path: window.location.pathname,
      hasOrder,
      isCartEmpty: itemCount === 0,
    }),
  );
  useEffect(() => {
    markLaunchHandled();
  }, []);
  return isChecked;
}

/**
 * On the first opening of a session at "/", an order that is still going on leads back to its
 * tracking. The catalogue waits, up to a limit; whatever goes wrong, it is shown as it is.
 */
export function LaunchProvider({ children }: { children: ReactNode }): ReactElement {
  const order = useLatestOrder();
  const isChecked = useIsLaunchChecked(order !== null);
  const [isReleased, setIsReleased] = useState(false);
  const [location, navigate] = useLocation();
  const check = useActiveOrder(isChecked ? order : null);
  const isHolding = isChecked && !isReleased;

  useEffect(() => {
    if (!isHolding) {
      return;
    }
    const timer = setTimeout(() => {
      setIsReleased(true);
    }, LAUNCH_CHECK_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isHolding]);

  useEffect(() => {
    if (!isHolding || check.isPending) {
      return;
    }
    setIsReleased(true);
    // Only while still on the catalogue: a customer who went elsewhere is left there.
    if (check.data?.isActive === true && location === CATALOGUE_PATH) {
      navigate(TRACKING_PATH, { replace: true });
    }
  }, [isHolding, check.isPending, check.data, location, navigate]);

  const value = useMemo<LaunchValue>(() => ({ isHolding }), [isHolding]);
  return <LAUNCH_CONTEXT value={value}>{children}</LAUNCH_CONTEXT>;
}
