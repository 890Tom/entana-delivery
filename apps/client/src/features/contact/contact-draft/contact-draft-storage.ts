import { MAX_CONTACT_NAME_LENGTH, MAX_CUSTOMER_NOTE_LENGTH } from "@entana/contracts";

import { isValidContactName, isValidCustomerNote } from "../rules/contact-rules";
import { isTypablePhone } from "../rules/phone-number";

/** What the customer has typed so far. Each text is "" until there is something. */
export interface ContactDraft {
  readonly name: string;
  /** The national part as typed, never the composed number. */
  readonly phone: string;
  readonly note: string;
}

export const EMPTY_CONTACT_DRAFT: ContactDraft = { name: "", phone: "", note: "" };

/** Versioned: a change of the stored shape starts a new key, and the old content is ignored. */
export const CONTACT_DRAFT_STORAGE_KEY = "entana.contact.v1";

const STORAGE_VERSION = 1;
// A draft is 80 + 20 + 300 characters: anything longer is not ours, and is not even parsed.
const MAX_STORED_LENGTH = 4096;
const KEYS: readonly string[] = ["version", "name", "phone", "note"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isStorableName = (name: string): boolean =>
  name === "" || (name.length <= MAX_CONTACT_NAME_LENGTH && isValidContactName(name));

const isStorableNote = (note: string): boolean =>
  note.length <= MAX_CUSTOMER_NOTE_LENGTH && note !== "" && isValidCustomerNote(note);

const isText = (value: unknown): value is string => typeof value === "string";

/** A stored note is a text the contract accepts, or null for "no note". */
function parseNote(note: unknown): string | undefined {
  if (note === null) {
    return "";
  }
  return isText(note) && isStorableNote(note) ? note : undefined;
}

function toDraft(stored: Record<string, unknown>): ContactDraft | null {
  const { version, name, phone } = stored;
  const note = parseNote(stored.note);
  if (version !== STORAGE_VERSION || !isText(name) || !isText(phone) || note === undefined) {
    return null;
  }
  return isStorableName(name) && isTypablePhone(phone) ? { name, phone, note } : null;
}

/**
 * The stored content is untrusted input: bounded before it is parsed, then checked key by key.
 * Anything that is not exactly what was written gives an empty draft, without an error.
 */
export function parseStoredContactDraft(raw: string | null): ContactDraft {
  if (raw === null || raw.length > MAX_STORED_LENGTH) {
    return EMPTY_CONTACT_DRAFT;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_CONTACT_DRAFT;
  }
  if (!isRecord(parsed)) {
    return EMPTY_CONTACT_DRAFT;
  }
  const own = Object.keys(parsed);
  const hasExactKeys = own.length === KEYS.length && KEYS.every((key) => own.includes(key));
  return (hasExactKeys ? toDraft(parsed) : null) ?? EMPTY_CONTACT_DRAFT;
}

/** A text still being typed that the rules refuse is stored as nothing, not as text. */
export function serializeContactDraft(draft: ContactDraft): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    name: isStorableName(draft.name) ? draft.name : "",
    phone: isTypablePhone(draft.phone) ? draft.phone : "",
    note: isStorableNote(draft.note) ? draft.note : null,
  });
}

/** Private browsing or a blocked storage makes even reaching `sessionStorage` throw. */
export function readStoredContactDraft(): ContactDraft {
  try {
    return parseStoredContactDraft(window.sessionStorage.getItem(CONTACT_DRAFT_STORAGE_KEY));
  } catch {
    return EMPTY_CONTACT_DRAFT;
  }
}

export function writeStoredContactDraft(draft: ContactDraft): void {
  try {
    window.sessionStorage.setItem(CONTACT_DRAFT_STORAGE_KEY, serializeContactDraft(draft));
  } catch {
    // Quota or private browsing: the draft goes on living in memory.
  }
}

export function clearStoredContactDraft(): void {
  try {
    window.sessionStorage.removeItem(CONTACT_DRAFT_STORAGE_KEY);
  } catch {
    // Nothing more can be done: the draft is emptied in memory.
  }
}
