import { InvalidConfigurationError, parseConfig } from "./config/app-config.js";
import { createApplication } from "./create-application.js";
import { loadInstanceConfig } from "./instance/load-instance-config.js";
import { resolveMediaRoot } from "./media/resolve-media-root.js";
import { StartupError } from "./startup/startup-error.js";

export interface ErrorOutput {
  write(text: string): unknown;
}

function describeFailure(error: unknown): string {
  if (error instanceof InvalidConfigurationError || error instanceof StartupError) {
    // Complete messages that name variables or keys, never values.
    return error.message;
  }
  return `The API could not start: ${error instanceof Error ? error.message : "unknown error"}`;
}

/**
 * Starts the API and returns the process exit code. The environment is validated first, then the
 * files it points to, all BEFORE Nest exists: a failure prints its message alone, with no stack
 * from the framework above it.
 */
export async function bootstrap(
  env: Readonly<Record<string, string | undefined>>,
  errors: ErrorOutput,
): Promise<number> {
  try {
    const config = parseConfig(env);
    loadInstanceConfig({ nodeEnv: config.nodeEnv, path: config.instanceConfigPath });
    resolveMediaRoot({ nodeEnv: config.nodeEnv, path: config.mediaRoot });
    const app = await createApplication(config);
    await app.listen(config.port, config.host);
    return 0;
  } catch (error: unknown) {
    errors.write(`${describeFailure(error)}\n`);
    return 1;
  }
}
