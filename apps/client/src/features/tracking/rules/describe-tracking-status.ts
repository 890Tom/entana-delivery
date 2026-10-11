import type { OrderStatus } from "@entana/contracts";

import { texts } from "../../../i18n/texts";

export type StepKey = "received" | "confirmed" | "outForDelivery" | "delivered";
type StepState = "done" | "current" | "upcoming";

export interface StepView {
  readonly key: StepKey;
  readonly state: StepState;
  /** The line under the name of the step. */
  readonly detail: string | null;
}

/** What the screen says of a status. Every text is fixed: none comes from the server. */
export interface StatusView {
  /** The title of the page on a phone. */
  readonly heading: string;
  readonly line: string;
  /** The steps of a delivery that goes on, or none for an order that ended otherwise. */
  readonly steps: readonly StepView[] | null;
  /** What the web card says in place of the heading: the day, or the same words. */
  readonly card: { readonly value: string; readonly line: string } | null;
  /** The shop's reason is shown under the line (a refusal only). */
  readonly hasReason: boolean;
}

/** The delivery day as written in a sentence and as a title; null when it is not set. */
export interface DeliveryDay {
  readonly sentence: string;
  readonly title: string;
}

const STEP_KEYS: readonly StepKey[] = ["received", "confirmed", "outForDelivery", "delivered"];

function toSteps(current: number, confirmedDetail: string | null): readonly StepView[] {
  return STEP_KEYS.map((key, index) => {
    const state: StepState = index < current ? "done" : index === current ? "current" : "upcoming";
    return { key, state, detail: key === "confirmed" ? confirmedDetail : null };
  });
}

const ALL_DONE: readonly StepView[] = STEP_KEYS.map((key) => ({
  key,
  state: "done",
  detail: null,
}));

function scheduled(current: number, stepName: string, day: DeliveryDay | null): StatusView {
  return {
    heading: day === null ? stepName : texts.tracking.deliveryOn(day.sentence),
    line: texts.tracking.courierCalls,
    steps: toSteps(current, day === null ? null : texts.tracking.deliveryOn(day.sentence)),
    card: { value: day === null ? stepName : day.title, line: texts.tracking.courierCalls },
    hasReason: false,
  };
}

function ended(heading: string, line: string, hasReason = false): StatusView {
  return { heading, line, steps: null, card: null, hasReason };
}

/**
 * The words and the steps of each of the seven statuses. A new status does not compile until it
 * has its row.
 */
export function describeTrackingStatus(status: OrderStatus, day: DeliveryDay | null): StatusView {
  const t = texts.tracking;
  switch (status) {
    case "NEW":
      return {
        heading: t.awaitingConfirmation,
        line: t.callToFixDay,
        steps: toSteps(0, t.awaitingConfirmation),
        card: { value: t.awaitingConfirmation, line: t.callToFixDay },
        hasReason: false,
      };
    case "CONFIRMED":
      return scheduled(1, t.steps.confirmed, day);
    case "OUT_FOR_DELIVERY":
      return scheduled(2, t.steps.outForDelivery, day);
    case "DELIVERED":
      return {
        heading: t.delivered.title,
        line: t.delivered.line,
        steps: ALL_DONE.map((step) => ({
          ...step,
          detail: step.key === "confirmed" && day !== null ? t.deliveryOn(day.sentence) : null,
        })),
        card: { value: t.delivered.title, line: t.delivered.line },
        hasReason: false,
      };
    case "REJECTED":
      return ended(t.rejected.title, t.rejected.line, true);
    case "CANCELLED":
      return ended(t.cancelled.title, t.cancelled.line);
    case "FAILED":
      return ended(t.failed.title, t.failed.line);
  }
}
