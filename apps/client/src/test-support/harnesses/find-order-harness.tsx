import type { PublicInstance } from "@entana/contracts";
import { fireEvent, screen } from "@testing-library/react";
import { vi } from "vitest";

import { texts } from "../../i18n/texts";

import { buildInstance } from "../builders/build-instance";
import { renderAt } from "./delivery-harness";
import { createFakeMapLoader } from "../stubs/fake-map";
import { jsonResponse } from "../stubs/stub-fetch";
import type { Answer } from "./tracking-harness";

const LOOKUP_ADDRESS = "/api/v1/tracking/lookup";
/** What a customer types: lowercase, a hyphen, the national zero. */
const TYPED_PHONE = "034 12 345 67";
const TYPED_CODE = "k7m-2qx";
/** What the server must receive for the two values above. */
export const SENT_BODY = { phone: "+261341234567", orderCode: "K7M2QX" };

interface OpenOptions {
  readonly lookup: Answer;
  readonly instance?: Partial<PublicInstance>;
}

export interface FindOrderApp {
  readonly lookupCalls: () => readonly (readonly [string, RequestInit | undefined])[];
}

/** Shows the screen with the network stubbed: the boundary, and nothing else. */
export function openFindOrder(options: OpenOptions): FindOrderApp {
  const instance = buildInstance(options.instance);
  const fetchStub = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    switch (input) {
      case "/api/v1/instance":
        return Promise.resolve(jsonResponse(instance));
      case LOOKUP_ADDRESS:
        return options.lookup();
      default:
        return Promise.resolve(jsonResponse({ products: [] }));
    }
  });
  vi.stubGlobal("fetch", fetchStub);
  sessionStorage.clear();
  localStorage.clear();
  renderAt("/retrouver", createFakeMapLoader());
  return {
    lookupCalls: () =>
      fetchStub.mock.calls.filter(
        (call): call is [string, RequestInit | undefined] => call[0] === LOOKUP_ADDRESS,
      ),
  };
}

export const phoneInput = (): Promise<HTMLInputElement> =>
  screen.findByRole<HTMLInputElement>("textbox", { name: texts.contact.phone.label });
export const codeInput = (): Promise<HTMLInputElement> =>
  screen.findByRole<HTMLInputElement>("textbox", { name: texts.findOrder.code.label });

/** The submit buttons of the page: the form's own, then the fixed bar's. */
const submitButtons = (): HTMLElement[] =>
  screen.getAllByRole("button", { name: texts.findOrder.submit });

/** The submit button of the form itself. */
export function formSubmitButton(): HTMLElement {
  const [button] = submitButtons();
  if (button === undefined) {
    throw new Error("The page has no submit button");
  }
  return button;
}

export async function fillAndSend(phone = TYPED_PHONE, code = TYPED_CODE): Promise<void> {
  fireEvent.change(await phoneInput(), { target: { value: phone } });
  fireEvent.change(await codeInput(), { target: { value: code } });
  fireEvent.click(formSubmitButton());
}

/** The body of a request, as sent. */
export function sentBody(call: readonly [string, RequestInit | undefined] | undefined): unknown {
  const body = call?.[1]?.body;
  return typeof body === "string" ? JSON.parse(body) : null;
}
