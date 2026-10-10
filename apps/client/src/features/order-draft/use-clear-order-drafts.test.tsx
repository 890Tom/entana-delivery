import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ContactDraftProvider } from "../contact/contact-draft/contact-draft-provider";
import { useContactDraft } from "../contact/contact-draft/contact-draft-context";
import { CONTACT_DRAFT_STORAGE_KEY } from "../contact/contact-draft/contact-draft-storage";
import { useDeliveryDraft } from "../delivery/delivery-draft/delivery-draft-context";
import { DeliveryDraftProvider } from "../delivery/delivery-draft/delivery-draft-provider";
import { DELIVERY_DRAFT_STORAGE_KEY } from "../delivery/delivery-draft/delivery-draft-storage";

import { useClearOrderDrafts } from "./use-clear-order-drafts";

function Probe(): ReactElement {
  const delivery = useDeliveryDraft();
  const contact = useContactDraft();
  const clearOrderDrafts = useClearOrderDrafts();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          delivery.setLandmark("Portail bleu");
          contact.setName("Rakoto");
          contact.setPhone("34 12 345 67");
          contact.setNote("Avant 15h.");
        }}
      >
        fill
      </button>
      <button
        type="button"
        onClick={() => {
          contact.save();
        }}
      >
        save
      </button>
      <button type="button" onClick={clearOrderDrafts}>
        clear
      </button>
      <p>{[delivery.landmark, contact.name, contact.phone, contact.note].join("|")}</p>
    </>
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(cleanup);

describe("clearing the drafts of the order", () => {
  it("empties the delivery draft and the contact draft, in memory and in the storage", () => {
    render(
      <DeliveryDraftProvider>
        <ContactDraftProvider>
          <Probe />
        </ContactDraftProvider>
      </DeliveryDraftProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "fill" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(sessionStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(CONTACT_DRAFT_STORAGE_KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "clear" }));

    expect(screen.getByText("|||")).toBeTruthy();
    expect(sessionStorage.getItem(DELIVERY_DRAFT_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(CONTACT_DRAFT_STORAGE_KEY)).toBeNull();
  });
});
