import type { StatusTransitionRequest } from "@entana/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { AdminResult } from "../../../data-fetching/fetch-admin";
import { ORDERS_KEY } from "../../orders/hooks/use-order-pages";
import { postStatusTransition } from "../api/order-detail-calls";

import { orderDetailKey } from "./use-order-detail";

export interface StatusChange {
  readonly isSending: boolean;
  /** `totalTooLarge`: an adjusted fee was refused; the confirmation says it under its field. */
  readonly notice: "conflict" | "failed" | "totalTooLarge" | null;
  /** Resolves true when the order moved. The data are read again whatever the answer. */
  readonly send: (request: StatusTransitionRequest) => Promise<boolean>;
}

/** What a refused change says: nothing for a session that ended (the reload shows the sign-in). */
function noticeOf(result: AdminResult<unknown>): StatusChange["notice"] {
  if (result.kind === "ok" || result.kind === "unauthorized") {
    return null;
  }
  if (result.problem === "totalTooLarge") {
    return "totalTooLarge";
  }
  return result.kind === "conflict" ? "conflict" : "failed";
}

/**
 * Sends one status change. On success the answer replaces the sheet at once and everything is
 * reloaded; a 409 says the status moved in between and reloads; a session that ended says
 * nothing here (the reload shows the sign-in).
 */
export function useStatusChange(orderId: string): StatusChange {
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<StatusChange["notice"]>(null);
  const send = async (request: StatusTransitionRequest): Promise<boolean> => {
    setNotice(null);
    setIsSending(true);
    const result = await postStatusTransition(orderId, request);
    setIsSending(false);
    if (result.kind === "ok") {
      queryClient.setQueryData(orderDetailKey(orderId), result.data);
    }
    setNotice(noticeOf(result));
    void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    return result.kind === "ok";
  };
  return { isSending, notice, send };
}
