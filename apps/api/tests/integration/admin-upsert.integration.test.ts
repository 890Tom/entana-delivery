import { hashPassword } from "@entana/password-hash";
import { describe, expect, it } from "vitest";
import { upsertAdminAccount } from "../../src/cli/upsert-admin-account.js";
import { FAKE_PASSWORD, useAdminHarness } from "./support/admin-harness.js";

describe("the admin:upsert account change on a real PostgreSQL", () => {
  const h = useAdminHarness();

  const change = async (
    email: string,
    options: { password?: string; isDisable?: boolean; displayName?: string } = {},
  ): ReturnType<typeof upsertAdminAccount> =>
    upsertAdminAccount(h.client, {
      email,
      displayName: options.displayName,
      passwordHash:
        options.isDisable === true
          ? undefined
          : await hashPassword(options.password ?? FAKE_PASSWORD),
      isDisable: options.isDisable ?? false,
      now: h.clock.now(),
    });

  it("creates an admin that can log in, named after the e-mail when no name is given", async () => {
    const email = h.newEmail();

    expect(await change(email)).toBe("created");

    const response = await h.login({ email, password: FAKE_PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ email, displayName: email.split("@")[0] });
    const row = await h.client.staffUser.findUniqueOrThrow({ where: { email } });
    expect(row).toMatchObject({ role: "ADMIN", active: true, username: email });
  });

  it("changes the password, ends the sessions opened with the old one and keeps the name", async () => {
    const email = h.newEmail();
    await change(email, { displayName: "Ana" });
    const cookie = h.cookieOf(await h.login({ email, password: FAKE_PASSWORD }));

    expect(await change(email, { password: "another fake password" })).toBe("password-updated");

    expect((await h.me(cookie)).status).toBe(401);
    expect((await h.login({ email, password: FAKE_PASSWORD })).status).toBe(401);
    const renewed = await h.login({ email, password: "another fake password" });
    expect(renewed.body).toMatchObject({ displayName: "Ana" });
  });

  it("disables the account and ends its sessions, then enables it with a new password", async () => {
    const email = h.newEmail();
    await change(email);
    const cookie = h.cookieOf(await h.login({ email, password: FAKE_PASSWORD }));

    expect(await change(email, { isDisable: true })).toBe("disabled");

    expect((await h.me(cookie)).status).toBe(401);
    expect((await h.login({ email, password: FAKE_PASSWORD })).status).toBe(401);
    await change(email);
    expect((await h.login({ email, password: FAKE_PASSWORD })).status).toBe(200);
  });

  it("reports an account that does not exist when asked to disable it", async () => {
    expect(await change(h.newEmail(), { isDisable: true })).toBe("not-found");
  });
});
