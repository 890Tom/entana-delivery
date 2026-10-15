import type { AdminReseller } from "@entana/contracts";
import { useState } from "react";
import { useLocation } from "wouter";

import { RESELLERS_PATH } from "../../../routes";
import { deleteReseller, postVerification } from "../api/reseller-calls";
import { describeFailure } from "../rules/describe-save-failure";

import { useResellersCache } from "../api/use-resellers";
import type { ResellersCache } from "../api/use-resellers";

export type ActionNotice = "verified" | "verifyFailed" | "deleteFailed" | "gone";

export interface ResellerActions {
  readonly notice: ActionNotice | null;
  readonly isBusy: boolean;
  /** The question of the deletion is open. */
  readonly isAsking: boolean;
  readonly verify: () => void;
  readonly askDelete: () => void;
  readonly cancelDelete: () => void;
  readonly confirmDelete: () => void;
}

interface Shared {
  readonly cache: ResellersCache;
  readonly setNotice: (notice: ActionNotice | null) => void;
  readonly setIsBusy: (isBusy: boolean) => void;
}

function runVerification(reseller: AdminReseller, shared: Shared): void {
  const { cache, setNotice, setIsBusy } = shared;
  setNotice(null);
  setIsBusy(true);
  void postVerification(reseller.id).then((result) => {
    setIsBusy(false);
    if (result.kind === "ok") {
      cache.replace(result.data);
      setNotice("verified");
      return;
    }
    const view = describeFailure(result);
    if (view.isUnauthorized) {
      cache.invalidate();
      return;
    }
    setNotice(view.notice === "gone" ? "gone" : "verifyFailed");
  });
}

/** A reseller that is already gone is what the person wanted: the list says so. */
function runDeletion(
  reseller: AdminReseller,
  shared: Shared,
  hooks: { readonly onSettled: () => void; readonly onDone: () => void },
): void {
  const { cache, setNotice, setIsBusy } = shared;
  setIsBusy(true);
  void deleteReseller(reseller.id).then((result) => {
    setIsBusy(false);
    // The question is closed whatever the answer: a failure is told on the form behind it.
    hooks.onSettled();
    if (result.kind === "ok" || result.kind === "not_found") {
      cache.remove(reseller.id);
      cache.invalidate();
      hooks.onDone();
      return;
    }
    if (result.kind === "unauthorized") {
      cache.invalidate();
      return;
    }
    setNotice("deleteFailed");
  });
}

/** The two actions of a reseller that exists, apart from the form: its verification and its deletion. */
export function useResellerActions(reseller: AdminReseller): ResellerActions {
  const cache = useResellersCache();
  const [, navigate] = useLocation();
  const [notice, setNotice] = useState<ActionNotice | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const shared: Shared = { cache, setNotice, setIsBusy };
  return {
    notice,
    isBusy,
    isAsking,
    verify: () => {
      if (!isBusy) {
        runVerification(reseller, shared);
      }
    },
    askDelete: () => {
      setNotice(null);
      setIsAsking(true);
    },
    cancelDelete: () => {
      setIsAsking(false);
    },
    confirmDelete: () => {
      runDeletion(reseller, shared, {
        onSettled: () => {
          setIsAsking(false);
        },
        onDone: () => {
          navigate(RESELLERS_PATH);
        },
      });
    },
  };
}
