import type { PublicReseller } from "@entana/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";

import { App } from "../../app";
import { createQueryClient } from "../../data-fetching/query-client";
import { RESELLERS_MAP_LOADER_CONTEXT } from "../../features/resellers/map/resellers-map-loader-context";
import { texts } from "../../i18n/texts";
import { RESELLERS_PATH } from "../../routes";
import { buildInstance } from "../builders/build-instance";
import type { FakeResellersMap, FakeResellersMapLoader } from "../stubs/fake-resellers-map";
import { jsonResponse, problemResponse } from "../stubs/stub-fetch";

const INSTANCE = buildInstance({
  map: {
    styleUrl: "https://style.example/custom",
    center: { lat: -18.8, lng: 47.4 },
    zoom: 13,
  },
});

/** Where the customer is in the tests. None of it may reach the network or any storage. */
export const CUSTOMER = { lat: -18.9, lng: 47.52 };

function build(position: number, overrides: Partial<PublicReseller>): PublicReseller {
  return {
    id: `0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5${String(position)}`,
    name: `Demo Shop ${String(position)}`,
    neighborhood: "Demo Area",
    landmark: "Next to the fake market",
    latitude: -18.9,
    longitude: 47.52,
    ...overrides,
  };
}

// In the order of the API (by neighborhood), which is not the order of the distance.
export const FAR = build(1, { neighborhood: "Ampéfiloha", latitude: -18.95 });
export const NEAR = build(2, { neighborhood: "Isotry", latitude: -18.905 });
export const MIDDLE = build(3, { neighborhood: "Isoraka", latitude: -18.92 });
export const RESELLERS = [FAR, NEAR, MIDDLE];

type ResellersAnswer = () => Promise<Response>;

export interface ResellersApp {
  /** Every request the page made, by address and init. */
  readonly calls: () => readonly (readonly [string, RequestInit | undefined])[];
}

/** The whole application at the resellers screen, with the network answered by address. */
export function openResellers(
  fake: FakeResellersMapLoader,
  answer: ResellersAnswer = () => Promise.resolve(jsonResponse({ resellers: RESELLERS })),
): ResellersApp {
  const fetchStub = vi.fn((input: RequestInfo | URL, _init?: RequestInit) =>
    input === "/api/v1/instance" ? Promise.resolve(jsonResponse(INSTANCE)) : answer(),
  );
  vi.stubGlobal("fetch", fetchStub);
  window.history.pushState({}, "", RESELLERS_PATH);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RESELLERS_MAP_LOADER_CONTEXT value={fake.loader}>
        <App />
      </RESELLERS_MAP_LOADER_CONTEXT>
    </QueryClientProvider>,
  );
  return {
    calls: () =>
      fetchStub.mock.calls.map(
        ([url, init]) => [typeof url === "string" ? url : "", init] as const,
      ),
  };
}

export function failingAnswer(): ResellersAnswer {
  return () => Promise.resolve(problemResponse(500));
}

/** Waits for the map load to be asked for, then settles it as a success. */
export async function readyMap(fake: FakeResellersMapLoader): Promise<FakeResellersMap> {
  await waitFor(() => {
    expect(fake.loader).toHaveBeenCalled();
  });
  const map = act(() => fake.succeed());
  await screen.findByRole("group", { name: texts.resellers.map.label });
  return map;
}

export const nearbyButton = (): HTMLElement =>
  screen.getByRole("button", { name: texts.resellers.nearby });

export const neighborhoodField = (): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>("textbox", { name: texts.resellers.neighborhood.label });

/** The names of the cards, in the order of the list. */
export function shownNames(): string[] {
  return screen
    .getAllByRole("listitem")
    .map((item) => item.querySelector("button")?.textContent ?? "");
}
