/** The part of a Zod schema that a request needs: the shared schemas of `contracts` fit it. */
interface ResponseSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

/**
 * What a call answers, by kind only: no status, no response text, no URL. The interface never
 * shows a word that came from the server.
 */
export type AdminResult<T> =
  | { readonly kind: "ok"; readonly data: T }
  | { readonly kind: "unauthorized" }
  | { readonly kind: "rate_limited" }
  | { readonly kind: "invalid" }
  /** The thing asked for does not exist (an order id the server does not know). */
  | { readonly kind: "not_found" }
  /** The thing changed in between (a status that moved): the caller reloads and says so. */
  | { readonly kind: "conflict" }
  | { readonly kind: "failure" };

export type AdminFailure = Exclude<AdminResult<never>, { kind: "ok" }>;

interface AdminRequest {
  /** A fixed address of the API, never built from an input. */
  readonly path: string;
  readonly method?: "GET" | "POST";
  /** Serialised as JSON. Never log it: it may hold a password. */
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

function toFailure(status: number): AdminFailure {
  switch (status) {
    case UNAUTHORIZED:
      return { kind: "unauthorized" };
    case TOO_MANY_REQUESTS:
      return { kind: "rate_limited" };
    case BAD_REQUEST:
    case UNPROCESSABLE:
      return { kind: "invalid" };
    case NOT_FOUND:
      return { kind: "not_found" };
    case CONFLICT:
      return { kind: "conflict" };
    default:
      return { kind: "failure" };
  }
}

interface Exchange {
  readonly status: number;
  readonly isOk: boolean;
  /** The parsed JSON body of a successful answer; undefined when it was not read or not JSON. */
  readonly body: unknown;
}

/**
 * Sends the request and, for a successful answer, reads its body, all under one timeout: a
 * server that sends the headers and then stalls cannot leave the screen waiting. Null when it
 * never produced an answer (network, timeout, redirect).
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
  const hasBody = request.body !== undefined;
  try {
    const response = await fetch(request.path, {
      method: request.method ?? "GET",
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      redirect: "error",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(request.body) : undefined,
      signal,
    });
    const body = response.ok && isBodyNeeded ? await readBody(response) : undefined;
    return { status: response.status, isOk: response.ok, body };
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
    return toFailure(answer.status);
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
  return answer.isOk ? { kind: "ok", data: null } : toFailure(answer.status);
}
