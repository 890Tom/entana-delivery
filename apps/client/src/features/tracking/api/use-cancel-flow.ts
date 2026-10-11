import { useRef, useState } from "react";

import { TrackingConflictError } from "./request-tracking";
import { useCancelTracking } from "./use-tracking";

type CancelFailure = "conflict" | "failed";

export interface CancelFlow {
  readonly isAsking: boolean;
  readonly isSending: boolean;
  /** The customer's own cancellation was accepted. */
  readonly isDone: boolean;
  readonly failure: CancelFailure | null;
  readonly ask: () => void;
  readonly keep: () => void;
  readonly confirm: () => void;
}

/** The two steps of a cancellation: the question, then the request, sent at most once at a time. */
export function useCancelFlow(token: string): CancelFlow {
  const mutation = useCancelTracking(token);
  const [isAsking, setIsAsking] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [failure, setFailure] = useState<CancelFailure | null>(null);
  // A second click arrives before the first one has been rendered as pending.
  const isInFlight = useRef(false);
  return {
    isAsking,
    isSending: mutation.isPending,
    isDone,
    failure,
    ask: () => {
      setFailure(null);
      setIsAsking(true);
    },
    keep: () => {
      setIsAsking(false);
    },
    confirm: () => {
      if (isInFlight.current) {
        return;
      }
      isInFlight.current = true;
      setFailure(null);
      mutation.mutate(undefined, {
        onSuccess: () => {
          setIsDone(true);
        },
        onError: (error) => {
          setFailure(error instanceof TrackingConflictError ? "conflict" : "failed");
        },
        onSettled: () => {
          isInFlight.current = false;
          setIsAsking(false);
        },
      });
    },
  };
}
