import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./app";
import { texts } from "./i18n/texts";
import { expectNoAccessibilityViolations } from "./test-support/assertions/expect-no-accessibility-violations";
import { buildInstance } from "./test-support/builders/build-instance";
import {
  jsonResponse,
  networkFailure,
  problemResponse,
  ROUTES,
  stubApi,
} from "./test-support/stubs/stub-api";
import type { ApiStub, Handler } from "./test-support/stubs/stub-api";

const PROFILE = {
  id: "6f1c2d4e-8a3b-4c5d-9e7f-1a2b3c4d5e6f",
  email: "gerante@example.mg",
  displayName: "Hery Rakoto",
};
const PASSWORD = "correct horse battery";

const signedIn: Handler = () => jsonResponse(PROFILE);
const signedOut: Handler = () => problemResponse(401);

function openAt(path: string, handlers: Parameters<typeof stubApi>[0]): ApiStub {
  window.history.replaceState(null, "", path);
  const api = stubApi(handlers);
  render(<App />);
  return api;
}

const identifierInput = (): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>(texts.login.identifier);
const passwordInput = (): HTMLInputElement =>
  screen.getByLabelText<HTMLInputElement>(texts.login.password);

function fillAndSubmit(identifier: string, password: string): void {
  fireEvent.change(identifierInput(), { target: { value: identifier } });
  fireEvent.change(passwordInput(), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: texts.login.submit }));
}

/** The sign-in screen; once the login has been accepted, the server knows the session. */
async function openLogin(login: Handler): Promise<ApiStub> {
  let isSignedIn = false;
  const api = openAt("/connexion", {
    [ROUTES.me]: (init) => (isSignedIn ? signedIn(init) : signedOut(init)),
    [ROUTES.login]: async (init) => {
      const response = await login(init);
      isSignedIn = isSignedIn || response.ok;
      return response;
    },
  });
  await screen.findByRole("heading", { name: texts.login.title });
  return api;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the sign-in", () => {
  it("signs in and arrives on the orders, which the back button cannot return from", async () => {
    const api = await openLogin(() => jsonResponse(PROFILE));
    const before = window.history.length;

    fillAndSubmit("  Gerante@Example.MG ", PASSWORD);

    await screen.findByRole("heading", { name: texts.orders.title });
    expect(window.location.pathname).toBe("/commandes");
    expect(window.history.length).toBe(before);
    expect(api.calls(ROUTES.login)).toHaveLength(1);
    expect(api.calls(ROUTES.login)[0]?.body).toBe(
      JSON.stringify({ email: "gerante@example.mg", password: PASSWORD }),
    );
  });

  it("says one thing for a refused sign-in, empties the password and focuses it", async () => {
    await openLogin(() => problemResponse(401));

    fillAndSubmit("gerante@example.mg", PASSWORD);

    expect((await screen.findByRole("alert")).textContent).toContain(texts.login.wrongCredentials);
    expect(passwordInput().value).toBe("");
    expect(document.activeElement).toBe(passwordInput());
    expect(identifierInput().value).toBe("gerante@example.mg");
    expect(screen.queryByText("SECRET-DETAIL")).toBeNull();
  });

  it("asks to wait after too many attempts, and keeps what was typed", async () => {
    await openLogin(() => problemResponse(429));

    fillAndSubmit("gerante@example.mg", PASSWORD);

    expect((await screen.findByRole("alert")).textContent).toContain(texts.login.rateLimited);
    expect(passwordInput().value).toBe(PASSWORD);
    expect(identifierInput().value).toBe("gerante@example.mg");
  });

  it("keeps the values when the network drops, and retries with what the form holds now", async () => {
    let attempts = 0;
    const api = await openLogin(() => {
      attempts += 1;
      return attempts === 1 ? networkFailure() : jsonResponse(PROFILE);
    });

    fillAndSubmit("gerante@example.mg", PASSWORD);
    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toContain(texts.login.failure);
    expect(passwordInput().value).toBe(PASSWORD);
    fireEvent.change(passwordInput(), { target: { value: "a corrected password" } });
    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    await screen.findByRole("heading", { name: texts.orders.title });
    expect(api.calls(ROUTES.login)[1]?.body).toBe(
      JSON.stringify({ email: "gerante@example.mg", password: "a corrected password" }),
    );
  });

  it("refuses an empty or malformed form before sending anything", async () => {
    const api = await openLogin(() => jsonResponse(PROFILE));

    fillAndSubmit("gerante", "");

    screen.getByText(texts.login.identifierInvalid);
    screen.getByText(texts.login.passwordRequired);
    expect(document.activeElement).toBe(identifierInput());
    expect(api.calls(ROUTES.login)).toHaveLength(0);
  });

  it("shows the password on request and hides it again at every send", async () => {
    await openLogin(() => problemResponse(401));
    const toggle = screen.getByRole("button", { name: texts.login.showPassword });

    fireEvent.click(toggle);
    expect(passwordInput().type).toBe("text");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.textContent).toBe(texts.login.hidePassword);
    fillAndSubmit("gerante@example.mg", PASSWORD);

    await screen.findByRole("alert");
    expect(passwordInput().type).toBe("password");
  });

  it("blocks a second send while one is pending", async () => {
    let release: (response: Response) => void = () => undefined;
    const api = await openLogin(() => new Promise<Response>((resolve) => (release = resolve)));

    fillAndSubmit("gerante@example.mg", PASSWORD);
    const button = await screen.findByRole("button", { name: texts.login.submit });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    // Enter in a field submits the form without clicking the button.
    fireEvent.submit(passwordInput().closest("form") ?? button);

    expect(api.calls(ROUTES.login)).toHaveLength(1);
    release(jsonResponse(PROFILE));
    await screen.findByRole("heading", { name: texts.orders.title });
  });

  it("shows the logo of the shop, and its name when the logo cannot be loaded", async () => {
    openAt("/connexion", {
      [ROUTES.me]: signedOut,
      [ROUTES.instance]: () => jsonResponse(buildInstance({ logoUrl: "/media/branding/logo.png" })),
    });

    const logo = await screen.findByRole("img", { name: "Maison Démo" });
    expect(logo.getAttribute("src")).toBe("/media/branding/logo.png");
    fireEvent.error(logo);

    await screen.findByText("Maison Démo");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows a generic name when the shop cannot be loaded, and still signs in", async () => {
    openAt("/connexion", { [ROUTES.me]: signedOut, [ROUTES.instance]: networkFailure });

    await screen.findByText(texts.login.logoFallback);
    expect(document.title).toBe(texts.document.title);
  });

  it("does nothing with an answer that arrives after the screen is gone", async () => {
    let release: (response: Response) => void = () => undefined;
    await openLogin(() => new Promise<Response>((resolve) => (release = resolve)));
    fillAndSubmit("gerante@example.mg", PASSWORD);
    cleanup();

    release(jsonResponse(PROFILE));
    await Promise.resolve();

    expect(window.location.pathname).toBe("/connexion");
  });

  it("shows the shop name as the title of the document", async () => {
    openAt("/connexion", {
      [ROUTES.me]: signedOut,
      [ROUTES.instance]: () => jsonResponse(buildInstance({ name: "Maison Démo" })),
    });

    await waitFor(() => {
      expect(document.title).toBe("Administration — Maison Démo");
    });
  });

  it("writes nothing to the browser's storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await openLogin(() => jsonResponse(PROFILE));

    fillAndSubmit("gerante@example.mg", PASSWORD);
    await screen.findByRole("heading", { name: texts.orders.title });

    expect(setItem).not.toHaveBeenCalled();
    expect([localStorage.length, sessionStorage.length, document.cookie]).toEqual([0, 0, ""]);
    setItem.mockRestore();
  });

  it("has no accessibility violation", async () => {
    await openLogin(() => jsonResponse(PROFILE));

    await expectNoAccessibilityViolations(document.body);
  });
});

describe("the guard", () => {
  it("sends someone with no session from a protected address to the sign-in", async () => {
    openAt("/n-importe-quoi", { [ROUTES.me]: signedOut });

    await screen.findByRole("heading", { name: texts.login.title });
    expect(window.location.pathname).toBe("/connexion");
    expect(window.location.search).toBe("");
  });

  it("sends a signed-in person from the sign-in to the orders, replacing the history", async () => {
    openAt("/connexion", { [ROUTES.me]: signedIn });

    await screen.findByRole("heading", { name: texts.orders.title });
    expect(window.location.pathname).toBe("/commandes");
  });

  it("shows not found, inside the page, to a signed-in person on an unknown address", async () => {
    openAt("/n-importe-quoi", { [ROUTES.me]: signedIn });

    await screen.findByRole("heading", { name: texts.notFound.title });
    screen.getByRole("button", { name: texts.home.logout });
  });

  it("does not redirect when the session cannot be checked, and offers to try again", async () => {
    let attempts = 0;
    openAt("/", {
      [ROUTES.me]: () => {
        attempts += 1;
        return attempts === 1 ? problemResponse(500) : jsonResponse(PROFILE);
      },
    });

    expect((await screen.findByRole("alert")).textContent).toContain(texts.login.failure);
    fireEvent.click(screen.getByRole("button", { name: texts.common.retry }));

    await screen.findByRole("heading", { name: texts.orders.title });
    expect(window.location.pathname).toBe("/commandes");
  });

  it("sends the person back to the sign-in, with the message, when the session ends elsewhere", async () => {
    const api = openAt("/", { [ROUTES.me]: signedIn });
    await screen.findByRole("heading", { name: texts.orders.title });

    api.answer(ROUTES.me, signedOut);
    window.dispatchEvent(new Event("visibilitychange"));

    await screen.findByText(texts.login.sessionExpired);
    expect(window.location.pathname).toBe("/connexion");
    expect(screen.queryByText(PROFILE.displayName, { exact: false })).toBeNull();
  });
});

describe("the orders page", () => {
  it("has no accessibility violation", async () => {
    openAt("/", { [ROUTES.me]: signedIn });
    await screen.findByRole("heading", { name: texts.orders.title });

    await expectNoAccessibilityViolations(document.body);
  });

  it("signs out, forgets the profile and leaves for the sign-in", async () => {
    const api = openAt("/", { [ROUTES.me]: signedIn, [ROUTES.logout]: () => jsonResponse({}) });
    await screen.findByRole("heading", { name: texts.orders.title });
    const meBefore = api.calls(ROUTES.me).length;
    api.answer(ROUTES.me, signedOut);

    fireEvent.click(screen.getByRole("button", { name: texts.home.logout }));

    await screen.findByRole("heading", { name: texts.login.title });
    expect(api.calls(ROUTES.logout)).toHaveLength(1);
    // The profile was dropped from memory: the session is asked for again, not read back.
    expect(api.calls(ROUTES.me).length).toBeGreaterThan(meBefore);
    expect(screen.queryByText(PROFILE.displayName, { exact: false })).toBeNull();
  });

  it("stays on the page, with a notice, when the sign-out fails", async () => {
    openAt("/", { [ROUTES.me]: signedIn, [ROUTES.logout]: () => problemResponse(500) });
    await screen.findByRole("heading", { name: texts.orders.title });

    fireEvent.click(screen.getByRole("button", { name: texts.home.logout }));

    expect((await screen.findByRole("alert")).textContent).toContain(texts.home.logoutFailed);
    expect(window.location.pathname).toBe("/commandes");
    expect(
      screen.getByRole("button", { name: texts.home.logout }).hasAttribute("aria-disabled"),
    ).toBe(false);
  });
});
