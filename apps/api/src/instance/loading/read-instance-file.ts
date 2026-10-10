import { closeSync, openSync, readSync } from "node:fs";
import { InvalidInstanceConfigurationError } from "../errors/invalid-instance-configuration-error.js";

const MAX_INSTANCE_FILE_BYTES = 64 * 1024;

function readAtMost(path: string, limitBytes: number): Buffer {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(limitBytes + 1);
    const bytesRead = readSync(descriptor, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    closeSync(descriptor);
  }
}

/**
 * Reads the file as UTF-8 text, at most 64 KiB: one byte more is read to tell a file of exactly
 * the limit from a larger one, so a huge file is never loaded in memory.
 */
export function readInstanceFile(path: string): string {
  let content: Buffer;
  try {
    content = readAtMost(path, MAX_INSTANCE_FILE_BYTES);
  } catch (error: unknown) {
    const isMissing = error instanceof Error && "code" in error && error.code === "ENOENT";
    throw new InvalidInstanceConfigurationError(
      isMissing
        ? "Fichier de configuration de l'instance introuvable : vérifiez INSTANCE_CONFIG_PATH."
        : "Fichier de configuration de l'instance illisible : vérifiez INSTANCE_CONFIG_PATH et les droits d'accès.",
    );
  }
  if (content.length > MAX_INSTANCE_FILE_BYTES) {
    throw new InvalidInstanceConfigurationError(
      "Fichier de configuration de l'instance trop volumineux (64 Ko au maximum).",
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    throw new InvalidInstanceConfigurationError(
      "Fichier de configuration de l'instance invalide : il doit être en UTF-8.",
    );
  }
}
