import type { StatusTransitionRequest } from "@entana/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ORDERS_KEY } from "../../orders/hooks/use-order-pages";
import { postStatusTransition } from "../api/order-detail-calls";

import { orderDetailKey } from "./use-order-detail";

export interface StatusChange {
  readonly isSending: boolean;
  readonly notice: "conflict" | "failed" | null;
  /** Resolves true when the order moved. The data are read again whatever the answer. */
  readonly send: (request: StatusTransitionRequest) => Promise<boolean>;
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
    } else if (result.kind !== "unauthorized") {
      setNotice(result.kind === "conflict" ? "conflict" : "failed");
    }
    void queryClient.invalidateQueries({ queryKey: ORDERS_KEY });
    return result.kind === "ok";
  };
  return { isSending, notice, send };
}
