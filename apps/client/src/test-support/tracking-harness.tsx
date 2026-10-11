import type { PublicInstance, TrackingResponse } from "@entana/contracts";
import { screen } from "@testing-library/react";
import { vi } from "vitest";

import { CONFIRMED_ORDERS_STORAGE_KEY } from "../features/order-submission/storage/confirmed-orders-storage";
import { texts } from "../i18n/texts";

import { buildInstance } from "./build-instance";
import { renderAt } from "./delivery-harness";
import { createFakeMapLoader } from "./fake-map";
import { jsonResponse, problemResponse } from "./stub-fetch";

export const TOKEN = "A".repeat(43);
export const OTHER_TOKEN = "B".repeat(43);
export const TRACKING_ADDRESS = "/api/v1/tracking";
export const CANCEL_ADDRESS = "/api/v1/tracking/cancel";

function buildTracking(overrides: Partial<TrackingResponse> = {}): TrackingResponse {
  return {
    orderCode: "K7M2QX",
    status: "NEW",
    deliveryDate: null,
    landmarkText: "Portail bleu",
    totalAr: 3200,
    deliveryFeeAr: 1000,
    itemCount: 1,
    createdAt: new Date().toISOString(),
    rejectionReason: null,
    canCancel: true,
    ...overrides,
  };
}

/** What the network answers to one request. */
export type Answer = () => Promise<Response>;

export const viewAnswer =
  (overrides: Partial<TrackingResponse> = {}): Answer =>
  () =>
    Promise.resolve(jsonResponse(buildTracking(overrides)));
export const problemAnswer =
  (status: number): Answer =>
  () =>
    Promise.resolve(problemResponse(status));
export const networkFailure: Answer = () => Promise.reject(new TypeError("Failed to fetch"));

/** The answers in turn; the last one is the answer to every request after it. */
export function inSequence(...answers: readonly Answer[]): Answer {
  let count = 0;
  return () => {
    const answer = answers[Math.min(count, answers.length - 1)];
    count += 1;
    return answer === undefined ? networkFailure() : answer();
  };
}

interface StoredOrder {
  readonly code: string;
  readonly token: string;
}

interface OpenOptions {
  /** The address after the path: "#token". */
  readonly hash?: string;
  /** The orders of the device, the most recent first. */
  readonly stored?: readonly StoredOrder[];
  /** Keeps the storages as they are: the order was confirmed by the real send of the test. */
  readonly keepStorage?: boolean;
  readonly tracking?: Answer;
  readonly cancel?: Answer;
  readonly instance?: Partial<PublicInstance>;
}

export interface TrackingApp {
  readonly fetchStub: ReturnType<typeof vi.fn>;
  /** The requests made to one address. */
  readonly callsTo: (address: string) => readonly (readonly [string, RequestInit | undefined])[];
}

/** Shows the tracking screen with the network stubbed: the boundary, and nothing else. */
export function openTracking(options: OpenOptions = {}): TrackingApp {
  const instance = buildInstance(options.instance);
  const fetchStub = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    switch (input) {
      case "/api/v1/instance":
        return Promise.resolve(jsonResponse(instance));
      case TRACKING_ADDRESS:
        return (options.tracking ?? viewAnswer())();
      case CANCEL_ADDRESS:
        return (options.cancel ?? viewAnswer({ status: "CANCELLED", canCancel: false }))();
      default:
        return Promise.resolve(jsonResponse({ products: [] }));
    }
  });
  vi.stubGlobal("fetch", fetchStub);
  if (options.keepStorage !== true) {
    sessionStorage.clear();
    localStorage.clear();
    const orders = (options.stored ?? []).map((order) => ({
      ...order,
      createdAt: new Date().toISOString(),
    }));
    if (orders.length > 0) {
      localStorage.setItem(CONFIRMED_ORDERS_STORAGE_KEY, JSON.stringify({ version: 1, orders }));
    }
  }
  renderAt(`/suivi${options.hash ?? ""}`, createFakeMapLoader());
  return {
    fetchStub,
    callsTo: (address) =>
      fetchStub.mock.calls.filter(
        (call): call is [string, RequestInit | undefined] => call[0] === address,
      ),
  };
}

/** The orders the device remembers, as stored. */
export function storedOrders(): readonly { code: string; token: string }[] {
  const raw = localStorage.getItem(CONFIRMED_ORDERS_STORAGE_KEY);
  const content: unknown = JSON.parse(raw ?? "null");
  const orders = (content as { orders?: { code: string; token: string }[] } | null)?.orders;
  return orders ?? [];
}

export const cancelButton = (): Promise<HTMLElement> =>
  screen.findByRole("button", { name: texts.tracking.actions.cancel });

/** The header the request carried, from the options it was sent with. */
export function sentHeaders(call: readonly [string, RequestInit | undefined] | undefined): Headers {
  return new Headers(call?.[1]?.headers);
}
