import { adminLoginRequestSchema } from "@entana/contracts";
import type { AdminLoginRequest } from "@entana/contracts";

export type IdentifierProblem = "required" | "invalid";
export type PasswordProblem = "required" | "too-long";

export type LoginFormReading =
  | { readonly isValid: true; readonly request: AdminLoginRequest }
  | {
      readonly isValid: false;
      readonly identifier: IdentifierProblem | undefined;
      readonly password: PasswordProblem | undefined;
    };

/**
 * Checks the form before anything is sent. The shape comes from the shared schema, the one the
 * API applies; only the empty case is told apart, so that the message says what to do.
 */
export function readLoginForm(input: {
  readonly identifier: string;
  readonly password: string;
}): LoginFormReading {
  const parsed = adminLoginRequestSchema.safeParse({
    email: input.identifier,
    password: input.password,
  });
  if (parsed.success) {
    return { isValid: true, request: parsed.data };
  }
  const refused = new Set(parsed.error.issues.map((issue) => issue.path[0]));
  const identifier: IdentifierProblem | undefined =
    input.identifier.trim() === "" ? "required" : refused.has("email") ? "invalid" : undefined;
  const password: PasswordProblem | undefined =
    input.password === "" ? "required" : refused.has("password") ? "too-long" : undefined;
  return { isValid: false, identifier, password };
}
