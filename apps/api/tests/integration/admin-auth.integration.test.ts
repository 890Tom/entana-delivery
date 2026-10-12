import { adminProfileSchema, problemDetailsSchema } from "@entana/contracts";
import { describe, expect, it } from "vitest";
import { ADMIN_SESSION_IDLE_TIMEOUT_MS, ADMIN_SESSION_LIFETIME_MS } from "@entana/contracts";
import { countCellsContaining } from "./support/orders-fixtures.js";
import {
  COOKIE_NAME,
  FAKE_PASSWORD,
  LOGIN_PATH,
  ME_PATH,
  sha256,
  useAdminHarness,
} from "./support/admin-harness.js";

const EXACT_COOKIE = new RegExp(
  `^${COOKIE_NAME}=[A-Za-z0-9_-]{43}; Path=/; Max-Age=604800; HttpOnly; SameSite=Strict; Secure$`,
);
const FIXED_401 = {
  type: "about:blank",
  title: "Unauthorized",
  status: 401,
  detail: "Authentication is required.",
  instance: LOGIN_PATH,
} as const;

describe("the administration login on a real PostgreSQL", () => {
  const h = useAdminHarness();

  describe("logging in", () => {
    it("answers who is signed in, sets the exact cookie and never sends the token in the body", async () => {
      const { email, id } = await h.createAccount({ name: "Ana Rakoto" });

      const response = await h.login({
        email: ` ${email.toUpperCase()} `,
        password: FAKE_PASSWORD,
      });

      expect(response.status).toBe(200);
      expect(adminProfileSchema.parse(response.body)).toEqual({
        id,
        email,
        displayName: "Ana Rakoto",
      });
      expect(response.headers["set-cookie"]).toHaveLength(1);
      expect(response.headers["set-cookie"]?.[0]).toMatch(EXACT_COOKIE);
      expect(response.headers["cache-control"]).toBe("no-store");
      const token = h.cookieOf(response).split("=")[1] ?? "";
      expect(response.text).not.toContain(token);
    });

    it("stores the hash of the token and the token nowhere", async () => {
      const { email } = await h.createAccount();

      const response = await h.login({ email, password: FAKE_PASSWORD });

      const token = h.cookieOf(response).split("=")[1] ?? "";
      const sessions = await h.client.adminSession.findMany();
      expect(sessions.map((session) => session.tokenHash)).toEqual([sha256(token)]);
      expect(await countCellsContaining(h.client, token)).toBe(0);
    });

    it("answers the same 401 for an unknown account and for a wrong password", async () => {
      const { email } = await h.createAccount();

      const unknown = await h.login({ email: h.newEmail(), password: FAKE_PASSWORD });
      const wrong = await h.login({ email, password: "not the password" });

      for (const response of [unknown, wrong]) {
        expect(response.status).toBe(401);
        expect(response.headers["set-cookie"]).toBeUndefined();
        expect(response.body).toEqual(FIXED_401);
      }
      expect(wrong.text).toBe(unknown.text);
      expect(problemDetailsSchema.safeParse(wrong.body).success).toBe(true);
    });

    it.each([
      ["a disabled account", { isActive: false }],
      ["a driver", { role: "DRIVER" as const }],
    ])("answers that same 401 for %s, even with the right password", async (_label, account) => {
      const { email } = await h.createAccount(account);

      const response = await h.login({ email, password: FAKE_PASSWORD });

      expect(response.status).toBe(401);
      expect(response.body).toEqual(FIXED_401);
      expect(response.headers["set-cookie"]).toBeUndefined();
    });

    it("opens a new session at each login, and deletes the ones that can no longer be used", async () => {
      const { email } = await h.createAccount();
      const first = await h.login({ email, password: FAKE_PASSWORD });
      const second = await h.login({ email, password: FAKE_PASSWORD });
      expect(h.cookieOf(second)).not.toBe(h.cookieOf(first));
      expect(await h.client.adminSession.count()).toBe(2);

      h.clock.advanceMilliseconds(ADMIN_SESSION_LIFETIME_MS + 1000);
      await h.login({ email, password: FAKE_PASSWORD });

      expect(await h.client.adminSession.count()).toBe(1);
    });

    it("limits the failures of one account, whatever the address, and then refuses even the right password", async () => {
      const { email } = await h.createAccount();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const failed = await h.login({ email, password: "not the password" });
        expect(failed.status).toBe(401);
      }

      const limited = await h.login({ email, password: FAKE_PASSWORD });

      expect(limited.status).toBe(429);
      expect(limited.headers["retry-after"]).toBe("600");
      expect(limited.headers["set-cookie"]).toBeUndefined();
    });

    it("keeps the e-mail, the password and the token out of the logs", async () => {
      const { email } = await h.createAccount();
      await h.login({ email, password: "not the password" });
      const ok = await h.login({ email, password: FAKE_PASSWORD });
      const cookie = h.cookieOf(ok);
      await h.me(cookie);

      const logs = h.logs.text();

      expect(logs).not.toContain(email);
      expect(logs).not.toContain("not the password");
      expect(logs).not.toContain(FAKE_PASSWORD);
      expect(logs).not.toContain(cookie.split("=")[1] ?? "");
    });
  });

  describe("the guard", () => {
    it("answers who is signed in", async () => {
      const { email } = await h.createAccount({ name: "Ana Rakoto" });
      const cookie = h.cookieOf(await h.login({ email, password: FAKE_PASSWORD }));

      const response = await h.me(cookie);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email, displayName: "Ana Rakoto" });
      expect(response.headers["cache-control"]).toBe("no-store");
    });

    it("refuses a request with no cookie, with the fixed 401", async () => {
      const response = await h.me();

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ ...FIXED_401, instance: ME_PATH });
    });

    it("refuses a cookie that has the shape of a token but is not a session", async () => {
      const response = await h.me(`${COOKIE_NAME}=${"A".repeat(43)}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ ...FIXED_401, instance: ME_PATH });
    });

    it("refuses a session after its 7 days, even though it was used regularly", async () => {
      const { email } = await h.createAccount();
      const cookie = h.cookieOf(await h.login({ email, password: FAKE_PASSWORD }));
      for (let day = 0; day < 7; day += 1) {
        h.clock.advanceMilliseconds(ADMIN_SESSION_IDLE_TIMEOUT_MS - 1000);
        expect((await h.me(cookie)).status).toBe(200);
        h.clock.advanceMilliseconds(ADMIN_SESSION_IDLE_TIMEOUT_MS - 1000);
        expect((await h.me(cookie)).status).toBe(200);
      }
      h.clock.advanceMilliseconds(60_000);

      expect((await h.me(cookie)).status).toBe(401);
    });

    it("refuses a session that was not used for 12 hours", async () => {
      const { email } = await h.createAccount();
      const cookie = h.cookieOf(await h.login({ email, password: FAKE_PASSWORD }));

      h.clock.advanceMilliseconds(ADMIN_SESSION_IDLE_TIMEOUT_MS);

      expect((await h.me(cookie)).status).toBe(401);
    });

    it("refuses the session of an account that was disabled after the login", async () => {
      const { email, id } = await h.createAccount();
      const cookie = h.cookieOf(await h.login({ email, password: FAKE_PASSWORD }));
      await h.client.staffUser.update({ where: { id }, data: { active: false } });

      expect((await h.me(cookie)).status).toBe(401);
    });

    it("writes the last activity at most once a minute", async () => {
      const { email } = await h.createAccount();
      const cookie = h.cookieOf(await h.login({ email, password: FAKE_PASSWORD }));
      const readLastSeen = async (): Promise<number> =>
        (await h.client.adminSession.findFirstOrThrow()).lastSeenAt.getTime();
      const loggedAt = await readLastSeen();

      h.clock.advanceMilliseconds(59_000);
      await h.me(cookie);
      expect(await readLastSeen()).toBe(loggedAt);

      h.clock.advanceMilliseconds(1000);
      await h.me(cookie);
      expect(await readLastSeen()).toBe(loggedAt + 60_000);
    });
  });

  describe("logging out", () => {
    it("revokes the session and clears the cookie", async () => {
      const { email } = await h.createAccount();
      const cookie = h.cookieOf(await h.login({ email, password: FAKE_PASSWORD }));

      const response = await h.logout(cookie);

      expect(response.status).toBe(200);
      expect(response.headers["set-cookie"]?.[0]).toBe(
        `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure`,
      );
      expect((await h.me(cookie)).status).toBe(401);
      expect((await h.client.adminSession.findFirstOrThrow()).revokedAt).not.toBeNull();
    });

    it("answers 200 again when there is no session: it is idempotent", async () => {
      const response = await h.logout();

      expect(response.status).toBe(200);
    });
  });
});
