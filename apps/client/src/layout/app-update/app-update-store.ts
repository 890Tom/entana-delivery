/** Whether a new version of the service worker waits, readable by `useSyncExternalStore`. */
export interface AppUpdateStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly isWaiting: () => boolean;
  /** Called by the service worker registration when a new version is installed and waiting. */
  readonly markWaiting: () => void;
}

export function createAppUpdateStore(): AppUpdateStore {
  const listeners = new Set<() => void>();
  let isWaiting = false;
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isWaiting: () => isWaiting,
    markWaiting: () => {
      isWaiting = true;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}
