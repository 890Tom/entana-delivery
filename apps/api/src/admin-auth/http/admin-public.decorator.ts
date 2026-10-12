import { SetMetadata } from "@nestjs/common";
import type { CustomDecorator } from "@nestjs/common";

export const ADMIN_PUBLIC_KEY = "adminPublic";

/**
 * Takes a route out of the session check of the guard. Everything under /api/v1/admin is closed
 * unless this is written on the route: login (nobody has a session yet) and logout (it must
 * answer 200 whether or not a session exists, so that repeating it is harmless).
 */
export const adminPublic = (): CustomDecorator => SetMetadata(ADMIN_PUBLIC_KEY, true);
