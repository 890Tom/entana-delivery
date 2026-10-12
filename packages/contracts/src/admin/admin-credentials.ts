import { z } from "zod";

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;

// Code points, not UTF-16 units: an emoji counts for one character.
function countCharacters(text: string): number {
  return Array.from(text).length;
}

/** The key of an account: surrounding spaces and letter case do not make another person. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type PasswordValidation =
  | { readonly isValid: true }
  | { readonly isValid: false; readonly reason: "too-short" | "too-long" };

/** The policy for a password that is being set (the script). No rule of composition. */
export function validateAdminPassword(password: string): PasswordValidation {
  const length = countCharacters(password);
  if (length < ADMIN_PASSWORD_MIN_LENGTH) {
    return { isValid: false, reason: "too-short" };
  }
  if (length > ADMIN_PASSWORD_MAX_LENGTH) {
    return { isValid: false, reason: "too-long" };
  }
  return { isValid: true };
}

export const adminEmailSchema = z
  .string()
  .min(1, "is required")
  .max(MAX_EMAIL_LENGTH, { abort: true, error: "is too long" })
  .transform(normalizeEmail)
  .pipe(z.email("is not a valid address"));

/**
 * The body of the login. The password is only bounded: the length policy applies when a password
 * is set, so that a wrong short password gets the same answer as any other wrong password. The
 * value is never trimmed or normalised. Never log a parsed request.
 */
export const adminLoginRequestSchema = z.strictObject({
  email: adminEmailSchema,
  password: z
    .string()
    .min(1, "is required")
    .refine((value) => countCharacters(value) <= ADMIN_PASSWORD_MAX_LENGTH, "is too long"),
});

export type AdminLoginRequest = z.infer<typeof adminLoginRequestSchema>;
