import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function readIsOnline(): boolean {
  return navigator.onLine;
}

/**
 * False only when the browser knows it has no network. True does not prove that the network
 * works: a request that fails then shows the error state of its screen.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, readIsOnline);
}
