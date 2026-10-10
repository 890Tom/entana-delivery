import { parseDocument } from "yaml";
import { InvalidInstanceConfigurationError } from "../errors/invalid-instance-configuration-error.js";

// A configuration has no reason to reuse a node: no alias at all, which also rules out an alias
// explosion ("billion laughs").
const MAX_ALIAS_COUNT = 0;

const NOT_YAML_MESSAGE =
  "Fichier de configuration de l'instance invalide : ce n'est pas un document YAML correct.";

/**
 * Parses one YAML document with the core schema: no custom tag (an unknown tag is a warning of the
 * library, refused here), no merge key, no duplicate key, no alias. The library's own
 * messages quote the file, so none of them is passed on.
 */
export function parseInstanceYaml(text: string): unknown {
  try {
    const document = parseDocument(text, { schema: "core", merge: false, uniqueKeys: true });
    if (document.errors.length > 0 || document.warnings.length > 0) {
      throw new InvalidInstanceConfigurationError(NOT_YAML_MESSAGE);
    }
    return document.toJS({ maxAliasCount: MAX_ALIAS_COUNT }) as unknown;
  } catch (error: unknown) {
    // A very deep nesting overflows the stack of the parser: same message, no library text.
    throw error instanceof InvalidInstanceConfigurationError
      ? error
      : new InvalidInstanceConfigurationError(NOT_YAML_MESSAGE);
  }
}
