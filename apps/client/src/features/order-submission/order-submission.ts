import { createOrderRequestSchema } from "@entana/contracts";

import { buildOrderRequest } from "./request/build-order-request";
import type { OrderDrafts, OrderRequestBody } from "./request/build-order-request";
import {
  addConfirmedOrder,
  removeExpiredConfirmedOrders,
} from "./storage/confirmed-orders-storage";
import { createAttemptIds } from "./request/order-attempt-ids";
import { isSameRequest } from "./request/is-same-request";
import { isReplayable, isReplayedOnNetworkReturn } from "./order-submission-types";
import type {
  OrderAttempt,
  OrderConfirmation,
  OrderSubmissionResult,
  OrderSubmissionState,
} from "./order-submission-types";
import {
  clearStoredAttempt,
  readStoredAttempt,
  writeStoredAttempt,
} from "./storage/pending-order-storage";
import { sendOrder } from "./request/send-order";

/** The time of day, as milliseconds since the epoch: received, so that a test decides it. */
type Clock = () => number;

/** What one send needs besides the attempt. */
interface SendContext {
  readonly cleanup: OrderCleanup;
  readonly now: Clock;
  /** The replay made when the network came back: it never arms another one. */
  readonly isAutomaticReplay: boolean;
}

/**
 * The mounted hook, as the module sees it: what the screens hold now and what they do once the
 * order is confirmed. Read at the return of the network, never kept.
 */
export interface OrderSubmissionHost {
  readonly read: () => { readonly drafts: OrderDrafts; readonly cleanup: OrderCleanup };
}

/** What the screens do once the order is confirmed: forget the drafts, then the cart. */
export interface OrderCleanup {
  readonly clearDrafts: () => void;
  readonly clearCart: () => void;
}

// The state lives in the module, not in a component: a send goes on, and ends, when the screen
// that started it is gone.
let state: OrderSubmissionState = { status: "idle" };
let inFlight: Promise<OrderSubmissionState> | null = null;
// Kept in memory too, so that a storage that cannot be written does not lose the key.
let memoryAttempt: OrderAttempt | null = null;
let stopWaitingForNetwork: (() => void) | null = null;
let host: OrderSubmissionHost | null = null;
const listeners = new Set<() => void>();

export function getOrderSubmissionState(): OrderSubmissionState {
  return state;
}

export function subscribeToOrderSubmission(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: OrderSubmissionState): OrderSubmissionState {
  state = next;
  listeners.forEach((listener) => {
    listener();
  });
  return next;
}

const loadAttempt = (): OrderAttempt | null => readStoredAttempt() ?? memoryAttempt;

function saveAttempt(attempt: OrderAttempt): void {
  memoryAttempt = attempt;
  writeStoredAttempt(attempt);
}

function dropAttempt(): void {
  memoryAttempt = null;
  clearStoredAttempt();
}

/** Reuses the stored attempt for the same request, else starts one with a new key and token. */
function openAttempt(request: OrderRequestBody): OrderAttempt | null {
  const existing = loadAttempt();
  if (existing !== null && isSameRequest(existing.request, request)) {
    return existing;
  }
  const ids = createAttemptIds();
  if (ids === null) {
    return null;
  }
  // Parsed, not spread: the keys come out in the schema's order, the one a read from the storage
  // gives too, so that a replay is the same bytes as the first send.
  const parsed = createOrderRequestSchema.safeParse({ ...request, trackingToken: ids.token });
  if (!parsed.success) {
    return null;
  }
  const attempt: OrderAttempt = { key: ids.key, token: ids.token, request: parsed.data };
  saveAttempt(attempt);
  return attempt;
}

/** A step that fails must never stop the next ones: the order exists, and the code is shown. */
function attemptStep(step: () => void): void {
  try {
    step();
  } catch {
    // A storage that refuses, or a screen that is gone: the confirmation is published anyway.
  }
}

function confirm(
  attempt: OrderAttempt,
  confirmation: OrderConfirmation,
  context: SendContext,
): OrderSubmissionState {
  attemptStep(() => {
    const order = {
      code: confirmation.orderCode,
      token: attempt.token,
      createdAt: confirmation.createdAt,
    };
    addConfirmedOrder(order, context.now());
  });
  attemptStep(dropAttempt);
  attemptStep(context.cleanup.clearDrafts);
  attemptStep(context.cleanup.clearCart);
  return publish(confirmation);
}

function disarmNetworkReturn(): void {
  stopWaitingForNetwork?.();
}

/**
 * The replay the network's return makes: only if the order the screens would send now is still
 * the stored one. Otherwise nothing is sent, nothing is cleared and the attempt stays.
 */
async function replayIfUnchanged(now: Clock): Promise<void> {
  const current = host?.read();
  const attempt = loadAttempt();
  if (current === undefined || attempt === null) {
    return;
  }
  const built = buildOrderRequest(current.drafts);
  if (built.ok && isSameRequest(attempt.request, built.request)) {
    const context = { cleanup: current.cleanup, now, isAutomaticReplay: true };
    await runOnce(() => execute(attempt, context));
  }
}

/** One replay at most, armed while a hook is mounted, and reset by a replay or a cancel. */
function armNetworkReturn(now: Clock): void {
  disarmNetworkReturn();
  const onOnline = (): void => {
    disarmNetworkReturn();
    void replayIfUnchanged(now);
  };
  window.addEventListener("online", onOnline, { once: true });
  stopWaitingForNetwork = () => {
    window.removeEventListener("online", onOnline);
    stopWaitingForNetwork = null;
  };
}

/**
 * Declares the mounted hook. Returns what unmounts it, which also cancels the wait for the
 * network: with no screen to show it, an order is not sent behind the customer's back.
 *
 * One mounted hook is supported. With two instances at once, the last one to mount is the one
 * the module reads, and the unmount of that one disables the replay of the other.
 */
export function attachOrderSubmissionHost(next: OrderSubmissionHost): () => void {
  host = next;
  return () => {
    if (host === next) {
      host = null;
      disarmNetworkReturn();
    }
  };
}

async function execute(attempt: OrderAttempt, context: SendContext): Promise<OrderSubmissionState> {
  publish({ status: "sending" });
  const result: OrderSubmissionResult = await sendOrder(attempt);
  if (result.status === "confirmed") {
    return confirm(attempt, result, context);
  }
  if (!isReplayable(result.error)) {
    dropAttempt();
  } else if (
    !context.isAutomaticReplay &&
    host !== null &&
    isReplayedOnNetworkReturn(result.error)
  ) {
    armNetworkReturn(context.now);
  }
  return publish(result);
}

function replayStoredAttempt(context: SendContext): Promise<OrderSubmissionState> {
  const attempt = loadAttempt();
  return attempt === null ? Promise.resolve(state) : execute(attempt, context);
}

/** One send at a time: a call during a send gets that send's result. */
function runOnce(task: () => Promise<OrderSubmissionState>): Promise<OrderSubmissionState> {
  if (inFlight !== null) {
    return inFlight;
  }
  disarmNetworkReturn();
  const running = task().finally(() => {
    inFlight = null;
  });
  inFlight = running;
  return running;
}

/**
 * Sends the order made of the cart and the drafts. The attempt (key, token, body) is reused when
 * the request is the same as the stored one, so that a replay is the same order.
 */
export function submitOrder(
  drafts: OrderDrafts,
  cleanup: OrderCleanup,
  now: Clock = Date.now,
): Promise<OrderSubmissionState> {
  return runOnce(() => {
    removeExpiredConfirmedOrders(now());
    const built = buildOrderRequest(drafts);
    if (!built.ok) {
      const error = { type: "invalid_draft", fields: built.fields } as const;
      return Promise.resolve(publish({ status: "error", error }));
    }
    const attempt = openAttempt(built.request);
    if (attempt === null) {
      return Promise.resolve(publish({ status: "error", error: { type: "unexpected" } }));
    }
    return execute(attempt, { cleanup, now, isAutomaticReplay: false });
  });
}

/** Sends the stored attempt again, exactly as it was. Does nothing when there is none. */
export function retryOrder(
  cleanup: OrderCleanup,
  now: Clock = Date.now,
): Promise<OrderSubmissionState> {
  return runOnce(() => replayStoredAttempt({ cleanup, now, isAutomaticReplay: false }));
}

/**
 * Forgets a result: the state goes back to idle, except during a send, which it never touches.
 * The send screen calls it when it unmounts, so that a new mount does not show an old failure.
 * A confirmed order is the tracking screen's to dismiss, when the customer leaves the
 * confirmation: the hook does not do it, or the code would vanish with the screen that sent it.
 */
export function dismissOrderSubmission(): void {
  if (state.status !== "sending") {
    publish({ status: "idle" });
  }
}

/** For tests only (through `test-support`): the state must not leak from one case to the next. */
export function resetOrderSubmissionState(): void {
  disarmNetworkReturn();
  host = null;
  state = { status: "idle" };
  inFlight = null;
  memoryAttempt = null;
}
