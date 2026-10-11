import { isFinalStatus } from "@entana/contracts";
import type { OrderStatus } from "@entana/contracts";

export interface TrackingActionsView {
  readonly call: boolean;
  readonly cancel: boolean;
  readonly reorder: boolean;
}

/**
 * What the customer may do. The call needs a number and an order that goes on; the cancellation
 * is the server's own `canCancel`; an order that is finished can be ordered again.
 */
export function describeTrackingActions(
  status: OrderStatus,
  canCancel: boolean,
  hasPhone: boolean,
): TrackingActionsView {
  const isFinal = isFinalStatus(status);
  return { call: hasPhone && !isFinal, cancel: canCancel, reorder: isFinal };
}

/** What is on the screen at this moment: the question replaces the call and the cancel button. */
export function describeVisibleActions(
  available: TrackingActionsView,
  hasPhone: boolean,
  isAsking: boolean,
): TrackingActionsView & { readonly panel: boolean; readonly isAny: boolean } {
  const isPanelShown = available.cancel && isAsking;
  const isCallShown = hasPhone && available.call && !isPanelShown;
  const isCancelShown = available.cancel && !isPanelShown;
  return {
    call: isCallShown,
    cancel: isCancelShown,
    panel: isPanelShown,
    reorder: available.reorder,
    isAny: isCallShown || isCancelShown || isPanelShown || available.reorder,
  };
}
