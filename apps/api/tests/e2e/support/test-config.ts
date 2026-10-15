import { fileURLToPath } from "node:url";
import { parseConfig } from "../../../src/config/app-config.js";
import type { AppConfig } from "../../../src/config/app-config.js";

/**
 * No database listens here: the client connects on its first query, which the tests never make.
 * Not 5432: the CI integration job runs a real PostgreSQL there, which would refuse the password
 * (an error, 500) instead of the connection (unavailable, 503). Port 1 is privileged and unused.
 */
const TEST_DATABASE_URL = "postgresql://test:test@localhost:1/test";

/** The origin of the administration in tests. */
export const ADMIN_TEST_ORIGIN = "https://admin.example.mg";

/** The demo file, for a test that runs in production, where the path is required. */
export const DEMO_INSTANCE_CONFIG_PATH = fileURLToPath(
  new URL("../../../../../examples/demo/instance.config.yaml", import.meta.url),
);

/** A valid configuration for tests: silent logs, no CORS origin, Swagger on (not production). */
export function buildTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return parseConfig({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    DATABASE_URL: TEST_DATABASE_URL,
    // Required in production, which some tests select: a value for every test.
    ADMIN_ALLOWED_ORIGINS: ADMIN_TEST_ORIGIN,
    ...overrides,
  });
}
