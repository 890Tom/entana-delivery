import { parseConfig } from "../../../src/config/app-config.js";
import type { AppConfig } from "../../../src/config/app-config.js";

/** No database listens here: the client connects on its first query, which the tests never make. */
const TEST_DATABASE_URL = "postgresql://test:test@localhost:5432/test";

/** A valid configuration for tests: silent logs, no CORS origin, Swagger on (not production). */
export function buildTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return parseConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    DATABASE_URL: TEST_DATABASE_URL,
    ...overrides,
  });
}
