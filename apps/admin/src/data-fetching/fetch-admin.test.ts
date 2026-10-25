import { adminProfileSchema } from "@entana/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { jsonResponse, networkFailure, pendingUntilAborted } from "../test-support/stubs/stub-api";

import { fetchAdmin, sendAdminAction } from "./fetch-admin";

const PROFILE = {
  id: "6f1c2d4e-8a3b-4c5d-9e7f-1a2b3c4d5e6f",
  email: "a@b.mg",
  displayName: "Hery",
};

function stubFetch(answer: (init: RequestInit | undefined) => Promise<Response>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((_input: RequestInfo | URL, init?: RequestInit) => answer(init)),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchAdmin", () => {
  it("returns the validated body of a successful answer", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(PROFILE)));

    const result = await fetchAdmin({ path: "/api/v1/admin/auth/me" }, adminProfileSchema);

    expect(result).toEqual({ kind: "ok", data: PROFILE });
  });

  it("adds its parameters, encoded, to the fixed address", async () => {
    const addresses: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        addresses.push(input);
        return Promise.resolve(jsonResponse(PROFILE));
      }),
    );

    await fetchAdmin(
      { path: "/api/v1/x", params: new URLSearchParams({ q: "a&b c" }) },
      adminProfileSchema,
    );

    expect(addresses).toEqual(["/api/v1/x?q=a%26b+c"]);
  });

  it.each(["PUT", "PATCH"] as const)("sends a %s with its JSON body", async (method) => {
    let sent: RequestInit | undefined;
    stubFetch((init) => {
      sent = init;
      return Promise.resolve(jsonResponse(PROFILE));
    });

    await fetchAdmin({ path: "/x", method, body: { a: 1 } }, adminProfileSchema);

    expect(sent?.method).toBe(method);
    expect(sent?.body).toBe(JSON.stringify({ a: 1 }));
  });

  it.each([
    [401, "unauthorized"],
    [429, "rate_limited"],
    [400, "invalid"],
    [422, "invalid"],
    [403, "failure"],
    [500, "failure"],
  ])("answers %i with the kind %s, whatever the body says", async (status, kind) => {
    stubFetch(() => Promise.resolve(jsonResponse({ detail: "SECRET" }, status)));

    const result = await fetchAdmin({ path: "/x" }, adminProfileSchema);

    expect(result).toEqual({ kind });
  });

  it("is a failure when the answer does not match the schema or is not JSON", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ id: "not-a-uuid" })));
    const mismatch = await fetchAdmin({ path: "/x" }, adminProfileSchema);
    stubFetch(() => Promise.resolve(new Response("<html>", { status: 200 })));
    const notJson = await fetchAdmin({ path: "/x" }, adminProfileSchema);

    expect([mismatch, notJson]).toEqual([{ kind: "failure" }, { kind: "failure" }]);
  });

  it("is a failure when the network drops", async () => {
    stubFetch(networkFailure);

    expect(await fetchAdmin({ path: "/x" }, adminProfileSchema)).toEqual({ kind: "failure" });
  });

  it("gives up on a request that stays pending after ten seconds", async () => {
    vi.useFakeTimers();
    stubFetch(pendingUntilAborted);

    const pending = fetchAdmin({ path: "/x" }, adminProfileSchema);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toEqual({ kind: "failure" });
  });

  it("gives up on an answer whose body stalls after the headers", async () => {
    vi.useFakeTimers();
    stubFetch((init) =>
      Promise.resolve(
        Object.assign(new Response(null, { status: 200 }), {
          json: () => pendingUntilAborted(init),
        }),
      ),
    );

    const pending = fetchAdmin({ path: "/x" }, adminProfileSchema);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await pending).toEqual({ kind: "failure" });
  });

  it("rejects, rather than reports a failure, when the caller cancels the request", async () => {
    const caller = new AbortController();
    stubFetch(pendingUntilAborted);

    const pending = fetchAdmin({ path: "/x", signal: caller.signal }, adminProfileSchema);
    caller.abort();

    await expect(pending).rejects.toThrow();
  });

  it("sends JSON on the same origin, with no referrer and no redirect", async () => {
    let seen: RequestInit | undefined;
    stubFetch((init) => {
      seen = init;
      return Promise.resolve(jsonResponse(PROFILE));
    });

    await fetchAdmin(
      { path: "/x", method: "POST", body: { email: "a@b.mg", password: "p" } },
      adminProfileSchema,
    );

    expect(seen).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.mg", password: "p" }),
    });
  });

  describe("the problem of a refusal", () => {
    const problemBody = (type: string): object => ({
      type,
      title: "SECRET-TITLE",
      status: 409,
      detail: "SECRET-DETAIL",
      instance: "/api/v1/admin/products",
    });

    it("names a known problem by its key, and nothing else of the answer", async () => {
      stubFetch(() =>
        Promise.resolve(jsonResponse(problemBody("urn:entana:problem:sku_taken"), 409)),
      );

      const result = await fetchAdmin({ path: "/x" }, adminProfileSchema);

      expect(result).toEqual({ kind: "conflict", problem: "skuTaken" });
    });

    it("names the problem of a status that has no kind of its own", async () => {
      stubFetch(() =>
        Promise.resolve(jsonResponse(problemBody("urn:entana:problem:photo_too_large"), 413)),
      );

      const result = await fetchAdmin({ path: "/x" }, adminProfileSchema);

      expect(result).toEqual({ kind: "failure", problem: "photoTooLarge" });
    });

    it("names the problem of an order whose total would be too large", async () => {
      stubFetch(() =>
        Promise.resolve(jsonResponse(problemBody("urn:entana:problem:order_total_too_large"), 422)),
      );

      const result = await fetchAdmin({ path: "/x" }, adminProfileSchema);

      expect(result).toEqual({ kind: "invalid", problem: "totalTooLarge" });
    });

    it("ignores a problem type it does not know", async () => {
      stubFetch(() => Promise.resolve(jsonResponse(problemBody("urn:other:problem"), 409)));

      const result = await fetchAdmin({ path: "/x" }, adminProfileSchema);

      expect(result).toEqual({ kind: "conflict" });
    });
  });

  it("sends a form as it is, without a JSON content type", async () => {
    let seen: RequestInit | undefined;
    stubFetch((init) => {
      seen = init;
      return Promise.resolve(jsonResponse(PROFILE));
    });
    const form = new FormData();
    form.set("photo", new File(["x"], "photo.png", { type: "image/png" }));

    await fetchAdmin({ path: "/x", method: "PUT", body: form }, adminProfileSchema);

    expect(seen?.body).toBe(form);
    expect(seen?.headers).toBeUndefined();
  });
});

describe("sendAdminAction", () => {
  it("is a failure for a refused or lost action", async () => {
    stubFetch(() => Promise.resolve(jsonResponse({}, 500)));
    const refused = await sendAdminAction({ path: "/x", method: "POST" });
    stubFetch(networkFailure);
    const lost = await sendAdminAction({ path: "/x", method: "POST" });

    expect([refused, lost]).toEqual([{ kind: "failure" }, { kind: "failure" }]);
  });

  it("does not read a body", async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 200 })));

    expect(await sendAdminAction({ path: "/x", method: "POST" })).toEqual({
      kind: "ok",
      data: null,
    });
  });
});
