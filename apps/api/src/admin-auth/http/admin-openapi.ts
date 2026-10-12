import { applyDecorators } from "@nestjs/common";
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiSecurity } from "@nestjs/swagger";
import { adminProfileSchema, problemDetailsSchema } from "@entana/contracts";

/** The name of the security scheme in the OpenAPI document: the session is a cookie. */
export const ADMIN_SECURITY_SCHEME = "adminSession";

type Problem = readonly [number, string];

const FORBIDDEN_ORIGIN: Problem = [
  403,
  "The origin of a request that changes something is not allowed.",
];
const COMMON: readonly Problem[] = [
  [500, "An unexpected error. The body is generic."],
  [503, "The database is unreachable."],
];

const documentProblems = (problems: readonly Problem[]): MethodDecorator =>
  applyDecorators(
    ...problems.map(([status, description]) =>
      ApiResponse({ status, description, standardSchema: problemDetailsSchema }),
    ),
  );

// Obviously fake.
const EXAMPLE = { email: "admin@example.mg", password: "a fake password for tests" };

export const documentLogin = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: "Log in to the administration",
      description:
        "Sets the session cookie (HttpOnly, SameSite=Strict, Path=/, Secure in production, 7 days " +
        "at most, 12 hours of inactivity). The token is never in the body. An unknown account, a " +
        "wrong password, a disabled account and an account that is not an admin get the same 401. " +
        "Limited per address and per account.",
      operationId: "loginAdmin",
    }),
    ApiBody({
      schema: {
        type: "object",
        required: ["email", "password"],
        additionalProperties: false,
        properties: { email: { type: "string" }, password: { type: "string" } },
      },
      examples: { fake: { summary: "Fake values", value: EXAMPLE } },
    }),
    ApiOkResponse({
      description: "Who is signed in. The session is in the Set-Cookie header.",
      standardSchema: adminProfileSchema,
      headers: { "Set-Cookie": { description: "The session cookie.", schema: { type: "string" } } },
    }),
    documentProblems([
      [400, "Invalid body. Lists the invalid fields only, never their values."],
      [401, "The e-mail and the password do not match an account that can log in."],
      FORBIDDEN_ORIGIN,
      [415, "The content type is not application/json."],
      [429, "Too many attempts, from this address or for this account. The same body for both."],
      ...COMMON,
    ]),
  );

export const documentLogout = (): MethodDecorator =>
  applyDecorators(
    ApiOperation({
      summary: "Log out of the administration",
      description:
        "Revokes the session and clears the cookie. Idempotent: 200 with or without a session.",
      operationId: "logoutAdmin",
    }),
    ApiOkResponse({ description: "The session is over. No body." }),
    documentProblems([FORBIDDEN_ORIGIN, ...COMMON]),
  );

export const documentMe = (): MethodDecorator =>
  applyDecorators(
    ApiSecurity(ADMIN_SECURITY_SCHEME),
    ApiOperation({
      summary: "Who is signed in",
      description: "Closed by the guard of the administration, like every route under /admin.",
      operationId: "getAdminProfile",
    }),
    ApiOkResponse({ description: "The signed-in admin.", standardSchema: adminProfileSchema }),
    documentProblems([[401, "No valid session. The same answer for every reason."], ...COMMON]),
  );
