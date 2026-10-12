import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ClockModule } from "../clock/clock.module.js";
import type { AppConfig } from "../config/app-config.js";
import { DatabaseModule } from "../database/database.module.js";
import { AdminAuthController } from "./admin-auth.controller.js";
import { ADMIN_COOKIE_SETTINGS, AdminAuthGuard } from "./admin-auth.guard.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { AdminSessionService } from "./admin-session.service.js";
import { sessionCookieSettings } from "./http/session-cookie.js";
import { AdminLoginAccountRateLimiter } from "./rate-limit/admin-login-account-rate-limiter.js";
import { AdminLoginAddressRateLimiter } from "./rate-limit/admin-login-address-rate-limiter.js";

/**
 * The administration login, and the guard that closes everything under /api/v1/admin by default.
 * The guard is global (APP_GUARD) and decides on the path, so a route added to the area later is
 * closed without anyone having to remember it.
 */
@Module({})
export class AdminAuthModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AdminAuthModule,
      imports: [DatabaseModule.register(config), ClockModule],
      controllers: [AdminAuthController],
      providers: [
        AdminAuthService,
        AdminSessionService,
        AdminLoginAddressRateLimiter,
        AdminLoginAccountRateLimiter,
        {
          provide: ADMIN_COOKIE_SETTINGS,
          useValue: sessionCookieSettings(config.isAdminCookieSecure),
        },
        { provide: APP_GUARD, useClass: AdminAuthGuard },
      ],
      exports: [AdminLoginAddressRateLimiter],
    };
  }
}
