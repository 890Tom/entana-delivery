import { createContext, useContext } from "react";

/**
 * What the customer has typed on the contact screen: kept in memory, and in the session storage
 * once the screen is validly left. Personal data: it never leaves the device before the order.
 */
export interface ContactDraftValue {
  /** The texts as typed, "" when there is none. Never trimmed. */
  readonly name: string;
  readonly phone: string;
  readonly note: string;
  readonly setName: (name: string) => void;
  readonly setPhone: (phone: string) => void;
  readonly setNote: (note: string) => void;
  /** Writes the draft to the session storage now, unless that content is already there. */
  readonly save: () => void;
  /** Empties the draft in memory and in the storage (the order was sent). */
  readonly clear: () => void;
}

export const CONTACT_DRAFT_CONTEXT = createContext<ContactDraftValue | null>(null);

export function useContactDraft(): ContactDraftValue {
  const draft = useContext(CONTACT_DRAFT_CONTEXT);
  if (draft === null) {
    throw new Error("useContactDraft must be used inside a ContactDraftProvider");
  }
  return draft;
}
