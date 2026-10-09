import { InvalidConfigurationError, parseConfig } from "./config/app-config.js";
import type { AppConfig } from "./config/app-config.js";
import { InvalidInstanceConfigurationError } from "./instance/invalid-instance-configuration-error.js";
import { createApplication } from "./create-application.js";

function loadConfiguration(): AppConfig | undefined {
  try {
    return parseConfig(process.env);
  } catch (error: unknown) {
    if (error instanceof InvalidConfigurationError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
      return undefined;
    }
    throw error;
  }
}

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();
  if (config === undefined) {
    return;
  }
  const app = await createApplication(config);
  await app.listen(config.port, config.host);
}

bootstrap().catch((error: unknown) => {
  // Its message is already complete, in French, and names keys only.
  const message =
    error instanceof InvalidInstanceConfigurationError
      ? error.message
      : `The API could not start: ${error instanceof Error ? error.message : "unknown error"}`;
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
