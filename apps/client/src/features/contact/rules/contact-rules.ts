import { createOrderRequestSchema } from "@entana/contracts";

// The rules of both texts are the contract's own: nothing is added here.
const NAME_SCHEMA = createOrderRequestSchema.shape.contactName;
const NOTE_SCHEMA = createOrderRequestSchema.shape.customerNote;

/** Whether the name can be sent: 1 to 80 characters, not blank, no control character. */
export function isValidContactName(name: string): boolean {
  return NAME_SCHEMA.safeParse(name).success;
}

/** Whether the note can be sent. An empty note is valid: it is simply not sent. */
export function isValidCustomerNote(note: string): boolean {
  return NOTE_SCHEMA.safeParse(note).success;
}
