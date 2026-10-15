import { useState } from "react";
import { useLocation } from "wouter";

import { SETTINGS_PATH } from "../../../routes";
import { deleteAxis } from "../api/axes-calls";

export type AxisDeleteNotice = "inUse" | "deleteFailed";

export interface AxisDeleteModel {
  /** The question of the deletion is open. */
  readonly isAsking: boolean;
  readonly isBusy: boolean;
  readonly notice: AxisDeleteNotice | null;
  readonly ask: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

/**
 * The deletion of an axis, after a question; an axis that orders use is refused by the server.
 * A new axis (no id) has nothing to delete.
 */
export function useAxisDelete(axisId: string | null, reloadAxes: () => void): AxisDeleteModel {
  const [, navigate] = useLocation();
  const [isAsking, setIsAsking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<AxisDeleteNotice | null>(null);
  return {
    isAsking,
    isBusy,
    notice,
    ask: () => {
      setNotice(null);
      setIsAsking(true);
    },
    cancel: () => {
      setIsAsking(false);
    },
    confirm: () => {
      if (axisId === null || isBusy) {
        return;
      }
      setIsBusy(true);
      void deleteAxis(axisId).then((result) => {
        setIsBusy(false);
        // The question is closed whatever the answer: a refusal is told on the form behind it.
        setIsAsking(false);
        // An axis already gone is what the person wanted; a refused session shows the sign-in.
        if (result.kind === "ok" || result.kind === "not_found" || result.kind === "unauthorized") {
          reloadAxes();
          if (result.kind !== "unauthorized") {
            navigate(SETTINGS_PATH);
          }
          return;
        }
        setNotice(result.problem === "axisInUse" ? "inUse" : "deleteFailed");
      });
    },
  };
}
