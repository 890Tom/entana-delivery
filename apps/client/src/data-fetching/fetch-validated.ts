export const REQUEST_ERROR_KINDS = ["network", "timeout", "server", "unexpected"] as const;

export type RequestErrorKind = (typeof REQUEST_ERROR_KINDS)[number];

/** The part of a Zod schema that a request needs: the shared schemas of `contracts` fit it. */
interface ResponseSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

interface ValidatedRequest<T, E extends Error> {
  readonly url: string;
  readonly schema: ResponseSchema<T>;
  readonly signal?: AbortSignal | undefined;
  /** Sent as JSON with a POST when present: what it holds never goes into the address. */
  readonly body?: unknown;
  readonly createError: (kind: RequestErrorKind) => E;
}

const TIMEOUT_MS = 10_000;

class RequestFailure extends Error {
  readonly kind: RequestErrorKind;

  constructor(kind: RequestErrorKind) {
    super(`Request failed: ${kind}`);
    this.kind = kind;
  }
}

async function readValidated<T>(response: Response, schema: ResponseSchema<T>): Promise<T> {
  if (response.status >= 500) {
    throw new RequestFailure("server");
  }
  if (!response.ok) {
    throw new RequestFailure("unexpected");
  }
  const body: unknown = await response.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new RequestFailure("unexpected");
  }
  return parsed.data;
}

function classifyFailure(
  error: unknown,
  isTimedOut: boolean,
  callerSignal: AbortSignal | undefined,
): unknown {
  if (error instanceof RequestFailure) {
    return error;
  }
  if (isTimedOut) {
    return new RequestFailure("timeout");
  }
  if (callerSignal?.aborted === true) {
    // The caller cancelled on purpose (unmount): this is not a failure to report.
    return error;
  }
  // A body that is not JSON also lands here: a SyntaxError is "unexpected", a dropped connection
  // or a failed fetch is "network".
  return new RequestFailure(error instanceof SyntaxError ? "unexpected" : "network");
}

/** A GET as before, or a POST of a JSON body that no redirect or referrer can carry elsewhere. */
function toRequestInit(body: unknown, signal: AbortSignal): RequestInit {
  if (body === undefined) {
    return { method: "GET", credentials: "omit", signal };
  }
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    redirect: "error",
    signal,
  };
}

/**
 * GET a public address (or POST to it, with `body`) and validate the answer with its shared schema. Rejects with the error
 * made by `createError`, which carries only a kind (no response text, no status, no URL), or
 * with the abort of `signal`.
 */
export async function fetchValidated<T, E extends Error>(
  request: ValidatedRequest<T, E>,
): Promise<T> {
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort();
  }, TIMEOUT_MS);
  const combined =
    request.signal === undefined
      ? timeout.signal
      : AbortSignal.any([request.signal, timeout.signal]);
  try {
    const response = await fetch(request.url, toRequestInit(request.body, combined));
    return await readValidated(response, request.schema);
  } catch (error: unknown) {
    const failure = classifyFailure(error, timeout.signal.aborted, request.signal);
    throw failure instanceof RequestFailure ? request.createError(failure.kind) : failure;
  } finally {
    clearTimeout(timer);
  }
}
