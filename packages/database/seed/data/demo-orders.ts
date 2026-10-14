import { DEMO_OUT_OF_AXIS_FEE_AR, demoPhone } from "./config.ts";

type Status =
  "NEW" | "CONFIRMED" | "OUT_FOR_DELIVERY" | "DELIVERED" | "REJECTED" | "CANCELLED" | "FAILED";
type FeeReason = "IN_AXIS" | "OUT_OF_AXIS" | "ADJUSTED";
export type Actor = "CUSTOMER" | "STAFF" | "SYSTEM";

// What happened to an order, in order. The first step is always the creation.
// `onDeliveryDayAtHour` places a step on the delivery day, at that hour of Antananarivo, so that
// the history never contradicts the delivery date. Without it, the step is dated after creation.
export type Step =
  | {
      kind: "status";
      from: Status | null;
      to: Status;
      actor: Actor;
      minutesAfterCreation: number;
      onDeliveryDayAtHour?: number;
      payload?: object;
    }
  | { kind: "fee"; from: number; to: number; actor: Actor; minutesAfterCreation: number };

export interface DemoOrder {
  readonly customer: number; // index in DEMO_CUSTOMERS
  // Tracking token and order code: FAKE PUBLIC DEMO VALUES, written here on purpose so that the
  // demo orders can be found again. Real ones are random and secret (only the hash is stored).
  readonly token: string;
  readonly code: string;
  readonly place: number | null; // index of the place, null = no place matches
  readonly axis: string | null; // axis name, null = outside every axis
  readonly feeReason: FeeReason;
  readonly deliveryFee: number;
  readonly status: Status;
  readonly statusReason: string | null;
  // Days from today, null until the order is confirmed.
  readonly deliveryDayOffset: number | null;
  readonly createdMinutesAgo: number;
  readonly items: readonly { readonly product: string; readonly qty: number }[];
  readonly steps: readonly Step[];
}

export const DEMO_CUSTOMERS = [
  { phone: demoPhone(101), trustLevel: "KNOWN" },
  { phone: demoPhone(102), trustLevel: "NEW" },
  { phone: demoPhone(103), trustLevel: "NEW" },
  { phone: demoPhone(104), trustLevel: "KNOWN" },
  { phone: demoPhone(105), trustLevel: "NEW" },
] as const;

const DAY = 24 * 60;

// The codes avoid 0, O, 1 and I: see order-code.ts.
export const DEMO_ORDERS: readonly DemoOrder[] = [
  {
    customer: 0,
    token: "demo-tracking-token-01",
    code: "DEMA22",
    place: 1,
    axis: "Axe Nord",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "NEW",
    statusReason: null,
    deliveryDayOffset: null,
    createdMinutesAgo: 120,
    items: [
      { product: "alpha", qty: 2 },
      { product: "beta", qty: 1 },
    ],
    steps: [{ kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 }],
  },
  {
    customer: 1,
    token: "demo-tracking-token-02",
    code: "DEMB33",
    place: null,
    axis: null,
    feeReason: "OUT_OF_AXIS",
    deliveryFee: DEMO_OUT_OF_AXIS_FEE_AR,
    status: "NEW",
    statusReason: null,
    deliveryDayOffset: null,
    createdMinutesAgo: 300,
    items: [{ product: "gamma", qty: 1 }],
    steps: [{ kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 }],
  },
  {
    customer: 2,
    token: "demo-tracking-token-03",
    code: "DEMC44",
    place: 7,
    axis: "Axe Est",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "CONFIRMED",
    statusReason: null,
    deliveryDayOffset: 1,
    createdMinutesAgo: DAY,
    items: [
      { product: "beta", qty: 2 },
      { product: "epsilon", qty: 3 },
    ],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "CONFIRMED",
        actor: "STAFF",
        minutesAfterCreation: 90,
        payload: { deliveryDayOffset: 1 },
      },
    ],
  },
  {
    // The admin lowered the flat fee before confirming.
    customer: 3,
    token: "demo-tracking-token-04",
    code: "DEMD55",
    place: null,
    axis: null,
    feeReason: "ADJUSTED",
    deliveryFee: 2000,
    status: "CONFIRMED",
    statusReason: null,
    deliveryDayOffset: 2,
    createdMinutesAgo: 2 * DAY,
    items: [{ product: "alpha", qty: 4 }],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "fee",
        from: DEMO_OUT_OF_AXIS_FEE_AR,
        to: 2000,
        actor: "STAFF",
        minutesAfterCreation: 60,
      },
      {
        kind: "status",
        from: "NEW",
        to: "CONFIRMED",
        actor: "STAFF",
        minutesAfterCreation: 65,
        payload: { deliveryDayOffset: 2 },
      },
    ],
  },
  {
    customer: 0,
    token: "demo-tracking-token-05",
    code: "DEME66",
    place: 12,
    axis: "Axe Sud",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "OUT_FOR_DELIVERY",
    statusReason: null,
    deliveryDayOffset: 0,
    createdMinutesAgo: 2 * DAY,
    items: [
      { product: "alpha", qty: 1 },
      { product: "epsilon", qty: 2 },
    ],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "CONFIRMED",
        actor: "STAFF",
        minutesAfterCreation: 120,
        payload: { deliveryDayOffset: 0 },
      },
      {
        kind: "status",
        from: "CONFIRMED",
        to: "OUT_FOR_DELIVERY",
        actor: "STAFF",
        minutesAfterCreation: 2 * DAY - 180,
        onDeliveryDayAtHour: 8,
      },
    ],
  },
  {
    customer: 3,
    token: "demo-tracking-token-06",
    code: "DEMF77",
    place: 2,
    axis: "Axe Nord",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "DELIVERED",
    statusReason: null,
    deliveryDayOffset: -2,
    createdMinutesAgo: 4 * DAY,
    items: [{ product: "gamma", qty: 2 }],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "CONFIRMED",
        actor: "STAFF",
        minutesAfterCreation: 60,
        payload: { deliveryDayOffset: -2 },
      },
      {
        kind: "status",
        from: "CONFIRMED",
        to: "OUT_FOR_DELIVERY",
        actor: "STAFF",
        minutesAfterCreation: 2 * DAY + 480,
        onDeliveryDayAtHour: 8,
      },
      {
        kind: "status",
        from: "OUT_FOR_DELIVERY",
        to: "DELIVERED",
        actor: "STAFF",
        minutesAfterCreation: 2 * DAY + 600,
        onDeliveryDayAtHour: 14,
      },
    ],
  },
  {
    customer: 4,
    token: "demo-tracking-token-07",
    code: "DEMG88",
    place: null,
    axis: null,
    feeReason: "OUT_OF_AXIS",
    deliveryFee: DEMO_OUT_OF_AXIS_FEE_AR,
    status: "REJECTED",
    statusReason: "Demo reason: the address could not be located.",
    deliveryDayOffset: null,
    createdMinutesAgo: 3 * DAY,
    items: [{ product: "beta", qty: 1 }],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "REJECTED",
        actor: "STAFF",
        minutesAfterCreation: 45,
        payload: { reason: "Demo reason: the address could not be located." },
      },
    ],
  },
  {
    customer: 1,
    token: "demo-tracking-token-08",
    code: "DEMH99",
    place: 0,
    axis: "Axe Nord",
    feeReason: "IN_AXIS",
    deliveryFee: 0,
    status: "CANCELLED",
    statusReason: "Demo reason: cancelled at the customer's request.",
    deliveryDayOffset: null,
    createdMinutesAgo: 5 * DAY,
    items: [{ product: "epsilon", qty: 1 }],
    steps: [
      { kind: "status", from: null, to: "NEW", actor: "CUSTOMER", minutesAfterCreation: 0 },
      {
        kind: "status",
        from: "NEW",
        to: "CANCELLED",
        actor: "CUSTOMER",
        minutesAfterCreation: 30,
        payload: { reason: "Demo reason: cancelled at the customer's request." },
      },
    ],
  },
];
