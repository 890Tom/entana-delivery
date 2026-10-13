import { PRODUCT_PROBLEM_TYPES, problemDetailsSchema } from "@entana/contracts";

/** The part of a Zod schema that a request needs: the shared schemas of `contracts` fit it. */
interface ResponseSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

/**
 * A problem of the product form that the answer names. Only the types the contracts know are
 * reported, as a key of our own: no text of the answer ever reaches the interface.
 */
type AdminProblem = keyof typeof PRODUCT_PROBLEM_TYPES;

interface Failed<Kind extends string> {
  readonly kind: Kind;
  /** Present only when the refusal names one of the known problems (see `AdminProblem`). */
  readonly problem?: AdminProblem;
}

/**
 * What a call answers, by kind only: no status, no response text, no URL. The interface never
 * shows a word that came from the server.
 */
export type AdminResult<T> =
  | { readonly kind: "ok"; readonly data: T }
  | Failed<"unauthorized">
  | Failed<"rate_limited">
  | Failed<"invalid">
  /** The thing asked for does not exist (an order id the server does not know). */
  | Failed<"not_found">
  /** The thing changed in between (a status that moved): the caller reloads and says so. */
  | Failed<"conflict">
  | Failed<"failure">;

export type AdminFailure = Exclude<AdminResult<never>, { kind: "ok" }>;

interface AdminRequest {
  /** A fixed address of the API, never built from an input. */
  readonly path: string;
  readonly method?: "GET" | "POST" | "PUT" | "PATCH";
  /** Serialised as JSON, a `FormData` as it is. Never log it: it may hold a password. */
  readonly body?: unknown;
  readonly signal?: AbortSignal | undefined;
}

const TIMEOUT_MS = 10_000;
const UNAUTHORIZED = 401;
const TOO_MANY_REQUESTS = 429;
const BAD_REQUEST = 400;
const UNPROCESSABLE = 422;
const NOT_FOUND = 404;
const CONFLICT = 409;

function kindOf(status: number): AdminFailure["kind"] {
  switch (status) {
    case UNAUTHORIZED:
      return "unauthorized";
    case TOO_MANY_REQUESTS:
      return "rate_limited";
    case BAD_REQUEST:
    case UNPROCESSABLE:
      return "invalid";
    case NOT_FOUND:
      return "not_found";
    case CONFLICT:
      return "conflict";
    default:
      return "failure";
  }
}

function toFailure(status: number, problem: AdminProblem | undefined): AdminFailure {
  const kind = kindOf(status);
  return problem === undefined ? { kind } : { kind, problem };
}

const KNOWN_PROBLEMS = Object.entries(PRODUCT_PROBLEM_TYPES) as readonly [AdminProblem, string][];

/** The known problem an error body names, by its `type`; nothing else of the body is read. */
function knownProblemOf(body: unknown): AdminProblem | undefined {
  const parsed = problemDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return undefined;
  }
  return KNOWN_PROBLEMS.find(([, type]) => type === parsed.data.type)?.[0];
}

interface Exchange {
  readonly status: number;
  readonly isOk: boolean;
  /** The parsed JSON body of a successful answer; undefined when it was not read or not JSON. */
  readonly body: unknown;
  /** The known problem a refusal names, if any. */
  readonly problem: AdminProblem | undefined;
}

/** The options of the request: a form is sent as it is, anything else as JSON. */
function initOf(request: AdminRequest, signal: AbortSignal): RequestInit {
  const base: RequestInit = {
    method: request.method ?? "GET",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    redirect: "error",
    signal,
  };
  if (request.body === undefined) {
    return base;
  }
  if (request.body instanceof FormData) {
    // A form sets its own boundary: the browser writes the content type of a `FormData`.
    return { ...base, body: request.body };
  }
  return {
    ...base,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request.body),
  };
}

/** What an answer says: its body when it is a success that needs it, its problem when refused. */
async function readExchange(response: Response, isBodyNeeded: boolean): Promise<Exchange> {
  if (!response.ok) {
    return {
      status: response.status,
      isOk: false,
      body: undefined,
      problem: knownProblemOf(await readBody(response)),
    };
  }
  const body = isBodyNeeded ? await readBody(response) : undefined;
  return { status: response.status, isOk: true, body, problem: undefined };
}

/**
 * Sends the request and reads the answer, all under one timeout: a server that sends the
 * headers and then stalls cannot leave the screen waiting. Null when it never produced an
 * answer (network, timeout, redirect).
 */
async function exchange(request: AdminRequest, isBodyNeeded: boolean): Promise<Exchange | null> {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort();
  }, TIMEOUT_MS);
  const signal =
    request.signal === undefined
      ? timeout.signal
      : AbortSignal.any([request.signal, timeout.signal]);
  try {
    const response = await fetch(request.path, initOf(request, signal));
    return await readExchange(response, isBodyNeeded);
  } catch (error: unknown) {
    if (request.signal?.aborted === true) {
      // The caller cancelled on purpose (unmount): this is not a failure to report.
      throw error;
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    // A body that is not JSON (or that was cut) is a failure like any other.
    return undefined;
  }
}

/** Calls the API and validates the answer with its shared schema. */
export async function fetchAdmin<T>(
  request: AdminRequest,
  schema: ResponseSchema<T>,
): Promise<AdminResult<T>> {
  const answer = await exchange(request, true);
  if (answer === null) {
    return { kind: "failure" };
  }
  if (!answer.isOk) {
    return toFailure(answer.status, answer.problem);
  }
  const parsed = schema.safeParse(answer.body);
  return parsed.success ? { kind: "ok", data: parsed.data } : { kind: "failure" };
}

/** Calls an action whose answer has no body that matters (the logout). */
export async function sendAdminAction(request: AdminRequest): Promise<AdminResult<null>> {
  const answer = await exchange(request, false);
  if (answer === null) {
    return { kind: "failure" };
  }
  return answer.isOk ? { kind: "ok", data: null } : toFailure(answer.status, answer.problem);
}
