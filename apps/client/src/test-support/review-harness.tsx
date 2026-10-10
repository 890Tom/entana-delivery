import { screen, waitFor } from "@testing-library/react";

import { texts } from "../i18n/texts";
import { REVIEW_PATH } from "../routes";

import { NAME, openContact } from "./contact-harness";
import { created } from "./order-submission-answers";
import { problemResponse } from "./stub-fetch";

/** The contact draft of a customer who has filled the contact screen. */
export function contactDraft(note: string | null = null): string {
  return JSON.stringify({ version: 1, name: NAME, phone: "34 12 345 67", note });
}

type OpenOptions = Omit<NonNullable<Parameters<typeof openContact>[0]>, "path">;

/** The order review, with a cart, a delivery and a contact draft that are all valid. */
export function openReview(options: OpenOptions = {}): ReturnType<typeof openContact> {
  return openContact({ contactDraft: contactDraft(), ...options, path: REVIEW_PATH });
}

/** The answers of the order request. */
export const createdAnswer = (): Promise<Response> => Promise.resolve(created());
export const problemAnswer = (status: number) => (): Promise<Response> =>
  Promise.resolve(problemResponse(status));

/** The two "Envoyer la commande": the one of the fixed bar, and the one of the amounts card. */
export function sendButtons(): { readonly bar: HTMLElement; readonly card: HTMLElement } {
  const all = screen.getAllByRole("button", { name: texts.review.send });
  const card = all.find((button) => button.closest("section") !== null);
  const bar = all.find((button) => button !== card);
  if (card === undefined || bar === undefined || all.length !== 2) {
    throw new Error("The page must hold one button in the bar and one in the amounts card");
  }
  return { bar, card };
}

/** The send buttons, once the instance and the catalogue are loaded and the buttons are active. */
export async function readySendButtons(): ReturnType<
  typeof waitFor<ReturnType<typeof sendButtons>>
> {
  const buttons = await waitFor(sendButtons);
  await waitFor(() => {
    if (buttons.card.getAttribute("aria-disabled") !== null) {
      throw new Error("The send button is not active yet");
    }
  });
  return buttons;
}

/** The amounts card: the section that holds the "Total" line. */
export function amountsCard(): HTMLElement {
  const section = screen.getByText(texts.orderSummary.total).closest("section");
  if (section === null) {
    throw new Error("The amounts card is missing");
  }
  return section;
}

type Call = readonly [RequestInfo | URL, RequestInit | undefined];

const isOrderCall = (call: readonly unknown[]): call is Call => call[0] === "/api/v1/orders";

/** The requests made to the order address. */
export function orderCalls(stub: {
  readonly mock: { readonly calls: readonly (readonly unknown[])[] };
}): readonly Call[] {
  return stub.mock.calls.filter(isOrderCall);
}

export function headerOf(call: Call | undefined, name: string): string | undefined {
  const headers = call?.[1]?.headers;
  return headers === undefined ? undefined : (new Headers(headers).get(name) ?? undefined);
}
