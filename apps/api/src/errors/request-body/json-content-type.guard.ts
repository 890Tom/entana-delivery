import { Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { UnsupportedContentTypeError } from "./unsupported-content-type-error.js";

/**
 * Only application/json is accepted: the body parser leaves any other type unread, which would
 * otherwise reach the validation as an empty body. Runs before the pipes, so the answer does not
 * depend on what the body or the headers hold.
 */
@Injectable()
export class JsonContentTypeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.is("application/json") !== "application/json") {
      throw new UnsupportedContentTypeError();
    }
    return true;
  }
}
