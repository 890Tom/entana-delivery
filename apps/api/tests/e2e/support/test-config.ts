import { parseConfig } from "../../../src/config/app-config.js";
import type { AppConfig } from "../../../src/config/app-config.js";

/** A valid configuration for tests: silent logs, no CORS origin, Swagger on (not production). */
export function buildTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return parseConfig({ NODE_ENV: "test", LOG_LEVEL: "silent", ...overrides });
}
