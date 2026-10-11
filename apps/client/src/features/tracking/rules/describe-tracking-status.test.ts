import type { OrderStatus } from "@entana/contracts";
import { describe, expect, it } from "vitest";

import { describeTrackingActions } from "./describe-tracking-actions";
import { describeTrackingStatus } from "./describe-tracking-status";
import type { DeliveryDay } from "./describe-tracking-status";

const DAY: DeliveryDay = { sentence: "vendredi 2 octobre", title: "Vendredi 2 octobre" };

type StepNames = readonly (readonly [string, string])[] | null;

const CASES: readonly (readonly [
  OrderStatus,
  string,
  StepNames,
  { call: boolean; cancel: boolean; reorder: boolean },
])[] = [
  [
    "NEW",
    "En attente de confirmation",
    [
      ["received", "current"],
      ["confirmed", "upcoming"],
      ["outForDelivery", "upcoming"],
      ["delivered", "upcoming"],
    ],
    { call: true, cancel: true, reorder: false },
  ],
  [
    "CONFIRMED",
    "Livraison le vendredi 2 octobre",
    [
      ["received", "done"],
      ["confirmed", "current"],
      ["outForDelivery", "upcoming"],
      ["delivered", "upcoming"],
    ],
    { call: true, cancel: true, reorder: false },
  ],
  [
    "OUT_FOR_DELIVERY",
    "Livraison le vendredi 2 octobre",
    [
      ["received", "done"],
      ["confirmed", "done"],
      ["outForDelivery", "current"],
      ["delivered", "upcoming"],
    ],
    { call: true, cancel: false, reorder: false },
  ],
  [
    "DELIVERED",
    "Livrée",
    [
      ["received", "done"],
      ["confirmed", "done"],
      ["outForDelivery", "done"],
      ["delivered", "done"],
    ],
    { call: false, cancel: false, reorder: true },
  ],
  ["REJECTED", "Commande refusée", null, { call: false, cancel: false, reorder: true }],
  ["CANCELLED", "Commande annulée", null, { call: false, cancel: false, reorder: true }],
  ["FAILED", "Livraison impossible", null, { call: false, cancel: false, reorder: true }],
];

describe("the seven statuses", () => {
  it.each(CASES)(
    "%s says its title, its current step and what can be done",
    (status, heading, steps, actions) => {
      const view = describeTrackingStatus(status, DAY);
      // The server decides the cancellation: the cases give it as it answers for each status.
      const canCancel = status === "NEW" || status === "CONFIRMED";

      expect(view.heading).toBe(heading);
      expect(view.steps?.map((step) => [step.key, step.state]) ?? null).toEqual(steps);
      expect(describeTrackingActions(status, canCancel, true)).toEqual(actions);
    },
  );

  it("offers no call without a number", () => {
    expect(describeTrackingActions("NEW", true, false).call).toBe(false);
  });
});
