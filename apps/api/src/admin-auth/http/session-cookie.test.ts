import { describe, expect, it } from "vitest";
import {
  hasSessionCookie,
  readSessionToken,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  sessionCookieSettings,
} from "./session-cookie.js";

const TOKEN = "A".repeat(43);
const SECURE = sessionCookieSettings(true);
const PLAIN = sessionCookieSettings(false);

describe("session cookie", () => {
  it("is Secure with the __Host- prefix, HttpOnly, SameSite=Strict and Path=/, with no Domain", () => {
    expect(serializeSessionCookie(SECURE, TOKEN, 604_800)).toBe(
      `__Host-admin_session=${TOKEN}; Path=/; Max-Age=604800; HttpOnly; SameSite=Strict; Secure`,
    );
  });

  it("drops Secure and the prefix for local development over HTTP, nothing else", () => {
    expect(serializeSessionCookie(PLAIN, TOKEN, 60)).toBe(
      `admin_session=${TOKEN}; Path=/; Max-Age=60; HttpOnly; SameSite=Strict`,
    );
  });

  it("is cleared with the same attributes and a null age", () => {
    expect(serializeClearedSessionCookie(SECURE)).toBe(
      "__Host-admin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure",
    );
  });
});

describe("reading the cookie header", () => {
  it("finds the token among other cookies", () => {
    expect(readSessionToken(`theme=dark; admin_session=${TOKEN}; lang=fr`, PLAIN)).toBe(TOKEN);
  });

  it("does not read the cookie of the other mode: the prefix is part of the name", () => {
    expect(readSessionToken(`admin_session=${TOKEN}`, SECURE)).toBeUndefined();
  });

  it.each([
    ["no header", undefined],
    ["no cookie of that name", "theme=dark"],
    ["a value that is not a token", "admin_session=short"],
    ["an empty value", "admin_session="],
    ["a cookie that only ends with the name", `x_admin_session=${TOKEN}`],
  ])("has no token for %s", (_label, header) => {
    expect(readSessionToken(header, PLAIN)).toBeUndefined();
  });

  it("tells that a cookie is present even when its value is not a token", () => {
    expect(hasSessionCookie("admin_session=garbage", PLAIN)).toBe(true);
    expect(hasSessionCookie("theme=dark", PLAIN)).toBe(false);
  });
});
