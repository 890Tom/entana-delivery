import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { StartupError } from "../startup/startup-error.js";

// Outside production: a folder at the repository root, ignored by git. From src/media (or
// dist/media) up to the root.
const DEVELOPMENT_MEDIA_ROOT = fileURLToPath(new URL("../../../../media", import.meta.url));

export class InvalidMediaRootError extends StartupError {
  constructor(problem: string) {
    super(`Dossier de médias invalide : ${problem}`);
    this.name = "InvalidMediaRootError";
  }
}

export interface MediaRootSource {
  readonly nodeEnv: "development" | "test" | "production";
  readonly path: string | undefined;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The media folder. In production it must be given, absolute, and exist: a deployment that forgets
 * the volume must fail at startup, not answer 404 to every image. Elsewhere it defaults to a local
 * folder that need not exist. Messages name the variable, never the path.
 */
export function resolveMediaRoot({ nodeEnv, path }: MediaRootSource): string {
  if (path === undefined) {
    if (nodeEnv === "production") {
      throw new InvalidMediaRootError("la variable MEDIA_ROOT est obligatoire en production.");
    }
    return DEVELOPMENT_MEDIA_ROOT;
  }
  if (!isAbsolute(path)) {
    throw new InvalidMediaRootError("MEDIA_ROOT doit être un chemin absolu.");
  }
  if (nodeEnv === "production" && !isDirectory(path)) {
    throw new InvalidMediaRootError("MEDIA_ROOT doit désigner un dossier existant.");
  }
  return path;
}
