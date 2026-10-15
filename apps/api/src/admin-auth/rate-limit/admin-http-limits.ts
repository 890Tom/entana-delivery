/** Where the administration is mounted: the global prefix, the version and the area. */
export const ADMIN_PATH = "/api/v1/admin";
export const ADMIN_LOGIN_PATH = "/api/v1/admin/auth/login";

/** Login attempts per client address, whatever their outcome. */
export const ADMIN_LOGIN_ADDRESS_MAX_ATTEMPTS = 10;
export const ADMIN_LOGIN_ADDRESS_WINDOW_MS = 10 * 60_000;

/** Failed logins per account (the normalised e-mail), whatever the address. */
export const ADMIN_LOGIN_ACCOUNT_MAX_FAILURES = 10;
export const ADMIN_LOGIN_ACCOUNT_WINDOW_MS = 15 * 60_000;
