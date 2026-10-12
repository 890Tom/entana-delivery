import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import type { AdminLoginRequest, AdminProfile } from "@entana/contracts";
import { hashPassword, verifyPassword } from "@entana/password-hash";
import { DATABASE_CLIENT } from "../database/client-token/database-client.js";
import { AdminSessionService, toAdminProfile } from "./admin-session.service.js";
import type { OpenedSession } from "./admin-session.service.js";
import { AdminUnauthenticatedError } from "./errors/admin-auth-errors.js";
import { findAccountByEmail } from "./persistence/admin-auth-queries.js";
import type { AdminAuthDatabase } from "./persistence/admin-auth-queries.js";
import { AdminLoginAccountRateLimiter } from "./rate-limit/admin-login-account-rate-limiter.js";

export interface AdminLogin {
  readonly profile: AdminProfile;
  readonly session: OpenedSession;
}

/** The login of the administration. The logout and the session proof are in the session service. */
@Injectable()
export class AdminAuthService implements OnModuleInit {
  // The hash that a login for an unknown account is checked against: same algorithm and same
  // parameters as a real one, so the answer takes as long. Made once, at startup (never in the
  // path of a request, where the first unknown account would take twice as long), of a password
  // that nobody knows.
  private unknownAccountHash: string | undefined;

  constructor(
    @Inject(DATABASE_CLIENT) private readonly db: AdminAuthDatabase,
    private readonly sessions: AdminSessionService,
    private readonly accountLimiter: AdminLoginAccountRateLimiter,
  ) {}

  async onModuleInit(): Promise<void> {
    this.unknownAccountHash = await hashPassword(randomBytes(18).toString("base64url"));
  }

  /**
   * @throws AddressRateLimitedError when the account is limited.
   * @throws AdminUnauthenticatedError, the same for every cause of failure.
   */
  async login(request: AdminLoginRequest): Promise<AdminLogin> {
    this.accountLimiter.assertNotLimited(request.email);
    const account = await findAccountByEmail(this.db, request.email);
    const storedHash = account?.passwordHash ?? this.getUnknownAccountHash();
    // Always checked, even for an account that cannot log in: the time does not say which case.
    const isPasswordRight = await verifyPassword(request.password, storedHash);
    const profile = account === null ? undefined : toAdminProfile(account);
    if (account === null || profile === undefined || !isPasswordRight) {
      this.accountLimiter.recordFailure(request.email);
      throw new AdminUnauthenticatedError();
    }
    return { profile, session: await this.sessions.open(account.id) };
  }

  private getUnknownAccountHash(): string {
    if (this.unknownAccountHash === undefined) {
      // A programming error (the startup hook did not run), never a state of a live application.
      throw new Error("The unknown-account hash was not made at startup");
    }
    return this.unknownAccountHash;
  }
}
