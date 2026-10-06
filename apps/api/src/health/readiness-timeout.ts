/** How long the readiness check waits for the database before it gives up. */
export const DEFAULT_READINESS_TIMEOUT_MS = 2000;

/** Injection token of the timeout, so that a test can shorten it. */
export const READINESS_TIMEOUT_MS = Symbol("READINESS_TIMEOUT_MS");
