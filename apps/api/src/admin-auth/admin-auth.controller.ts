import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { adminLoginRequestSchema } from "@entana/contracts";
import type { AdminLoginRequest, AdminProfile } from "@entana/contracts";
import type { Request, Response } from "express";
import { JsonContentTypeGuard } from "../errors/request-body/json-content-type.guard.js";
import { AdminAuthService } from "./admin-auth.service.js";
import { ADMIN_COOKIE_SETTINGS } from "./http/admin-auth.guard.js";
import { AdminSessionService } from "./admin-session.service.js";
import { documentLogin, documentLogout, documentMe } from "./http/admin-openapi.js";
import { adminPublic } from "./http/admin-public.decorator.js";
import { currentAdmin } from "./http/authenticated-admin.js";
import {
  readSessionToken,
  serializeClearedSessionCookie,
  serializeSessionCookie,
} from "./http/session-cookie.js";
import type { SessionCookieSettings } from "./http/session-cookie.js";

const NO_STORE = "no-store";

@ApiTags("admin-auth")
@Controller({ path: "admin/auth", version: "1" })
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly sessions: AdminSessionService,
    @Inject(ADMIN_COOKIE_SETTINGS) private readonly cookie: SessionCookieSettings,
  ) {}

  @Post("login")
  @HttpCode(200)
  @adminPublic()
  @UseGuards(JsonContentTypeGuard)
  @Header("Cache-Control", NO_STORE)
  @documentLogin()
  async login(
    @Body({ schema: adminLoginRequestSchema }) body: AdminLoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminProfile> {
    const { profile, session } = await this.auth.login(body);
    response.setHeader(
      "Set-Cookie",
      serializeSessionCookie(this.cookie, session.token, session.maxAgeSeconds),
    );
    return profile;
  }

  @Post("logout")
  @HttpCode(200)
  @adminPublic()
  @Header("Cache-Control", NO_STORE)
  @documentLogout()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.close(readSessionToken(request.headers.cookie, this.cookie));
    response.setHeader("Set-Cookie", serializeClearedSessionCookie(this.cookie));
  }

  @Get("me")
  @Header("Cache-Control", NO_STORE)
  @documentMe()
  me(@currentAdmin() admin: AdminProfile): AdminProfile {
    return admin;
  }
}
