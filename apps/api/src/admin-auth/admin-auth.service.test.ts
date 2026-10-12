import { hashPassword } from "@entana/password-hash";
import type * as PasswordHash from "@entana/password-hash";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Clock } from "../clock/clock.js";
import { AdminAuthService } from "./admin-auth.service.js";
import type { AdminSessionService } from "./admin-session.service.js";
import { AdminUnauthenticatedError } from "./errors/admin-auth-errors.js";
import type { AdminAuthDatabase } from "./persistence/admin-auth-queries.js";
import { AdminLoginAccountRateLimiter } from "./rate-limit/admin-login-account-rate-limiter.js";

// The real hashing, with its calls counted: the only way to see when the hash is made.
vi.mock("@entana/password-hash", async (importOriginal) => {
  const actual = await importOriginal<typeof PasswordHash>();
  return { ...actual, hashPassword: vi.fn(actual.hashPassword) };
});

const clock: Clock = { now: () => new Date("2026-10-12T08:00:00.000Z") };
const request = { email: "nobody@example.mg", password: "a password that is wrong" };

function build(): AdminAuthService {
  // No account exists: the database answers nothing, and the session service is never reached.
  const db = {
    staffUser: { findUnique: vi.fn(() => Promise.resolve(null)) },
  } as unknown as AdminAuthDatabase;
  const sessions = {} as unknown as AdminSessionService;
  return new AdminAuthService(db, sessions, new AdminLoginAccountRateLimiter(clock));
}

describe("AdminAuthService, unknown account", () => {
  beforeEach(() => {
    vi.mocked(hashPassword).mockClear();
  });

  it("makes the hash once at startup, before the first login, and never again", async () => {
    const service = build();
    expect(hashPassword).not.toHaveBeenCalled();

    await service.onModuleInit();
    expect(hashPassword).toHaveBeenCalledTimes(1);
    await expect(service.login(request)).rejects.toBeInstanceOf(AdminUnauthenticatedError);
    await expect(service.login(request)).rejects.toBeInstanceOf(AdminUnauthenticatedError);

    expect(hashPassword).toHaveBeenCalledTimes(1);
  });

  it("does not make the hash in the path of a request when startup did not run", async () => {
    const service = build();

    await expect(service.login(request)).rejects.not.toBeInstanceOf(AdminUnauthenticatedError);

    expect(hashPassword).not.toHaveBeenCalled();
  });
});
