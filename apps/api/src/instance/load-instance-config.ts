import { fileURLToPath } from "node:url";
import { instanceConfigSchema } from "@entana/contracts";
import type { InstanceConfig } from "@entana/contracts";
import type { z } from "zod";
import { InvalidInstanceConfigurationError } from "./invalid-instance-configuration-error.js";
import { parseInstanceYaml } from "./parse-instance-yaml.js";
import { readInstanceFile } from "./read-instance-file.js";

// From src/instance (or dist/instance) up to the repository root.
const DEMO_CONFIG_PATH = fileURLToPath(
  new URL("../../../../examples/demo/instance.config.yaml", import.meta.url),
);

type Issue = z.core.$ZodIssue;

const MAX_KEY_NAME_LENGTH = 40;

export interface InstanceConfigSource {
  readonly nodeEnv: "development" | "test" | "production";
  readonly path: string | undefined;
}

function resolvePath({ nodeEnv, path }: InstanceConfigSource): string {
  if (path !== undefined) {
    return path;
  }
  if (nodeEnv === "production") {
    throw new InvalidInstanceConfigurationError(
      "Configuration de l'instance manquante : en production, la variable INSTANCE_CONFIG_PATH doit désigner le fichier de configuration.",
    );
  }
  return DEMO_CONFIG_PATH;
}

// The name of an unknown key comes from the file: keep it short and printable before showing it.
function toKeyName(key: PropertyKey): string {
  return String(key)
    .replace(/[^\w-]/g, "?")
    .slice(0, MAX_KEY_NAME_LENGTH);
}

function toKeyPaths(issue: Issue): string[] {
  const parent = issue.path.map(toKeyName);
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((key) => [...parent, toKeyName(key)].join("."));
  }
  return [parent.join(".") || "(racine)"];
}

function invalidKeys(issues: readonly Issue[]): string[] {
  return [...new Set(issues.flatMap(toKeyPaths))];
}

/** Loads and validates the instance configuration. Throws a French error that names keys only. */
export function loadInstanceConfig(source: InstanceConfigSource): InstanceConfig {
  const document = parseInstanceYaml(readInstanceFile(resolvePath(source)));
  const result = instanceConfigSchema.safeParse(document);
  if (!result.success) {
    throw new InvalidInstanceConfigurationError(
      [
        "Configuration de l'instance invalide. Clés à corriger :",
        ...invalidKeys(result.error.issues).map((key) => `  - ${key}`),
      ].join("\n"),
    );
  }
  return result.data;
}
