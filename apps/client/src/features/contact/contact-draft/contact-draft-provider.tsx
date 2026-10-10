import { useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { CONTACT_DRAFT_CONTEXT } from "./contact-draft-context";
import type { ContactDraftValue } from "./contact-draft-context";
import {
  EMPTY_CONTACT_DRAFT,
  clearStoredContactDraft,
  readStoredContactDraft,
  serializeContactDraft,
  writeStoredContactDraft,
} from "./contact-draft-storage";
import type { ContactDraft } from "./contact-draft-storage";

/**
 * Above the pages, so that the draft survives a visit to another screen, and a reload once it was
 * saved. Unlike the delivery draft it is written only when the customer validly continues: a
 * half-typed name or number is never left in the storage.
 */
export function ContactDraftProvider({ children }: { children: ReactNode }): ReactElement {
  const [initial] = useState<ContactDraft>(readStoredContactDraft);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [note, setNote] = useState(initial.note);
  // What the storage holds, so that an unchanged draft is not written again.
  const written = useRef(serializeContactDraft(initial));

  const value = useMemo<ContactDraftValue>(
    () => ({
      name,
      phone,
      note,
      setName,
      setPhone,
      setNote,
      save: () => {
        const content = serializeContactDraft({ name, phone, note });
        if (content !== written.current) {
          written.current = content;
          writeStoredContactDraft({ name, phone, note });
        }
      },
      clear: () => {
        written.current = serializeContactDraft(EMPTY_CONTACT_DRAFT);
        clearStoredContactDraft();
        setName("");
        setPhone("");
        setNote("");
      },
    }),
    [name, phone, note],
  );
  return <CONTACT_DRAFT_CONTEXT value={value}>{children}</CONTACT_DRAFT_CONTEXT>;
}
