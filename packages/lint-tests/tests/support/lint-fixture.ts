import { resolve } from "node:path";

import { ESLint, type Linter } from "eslint";
import tseslint from "typescript-eslint";

const ROOT = resolve(import.meta.dirname, "../../../..");

// The REAL root configuration, in its real order. The appended override only switches off the
// type-aware linting, so that a fixture needs no file on disk and no tsconfig; it never touches
// the rules under test.
const eslint = new ESLint({
  cwd: ROOT,
  overrideConfigFile: resolve(ROOT, "eslint.config.mjs"),
  overrideConfig: [tseslint.configs.disableTypeChecked],
});

export interface FixtureReport {
  readonly messages: readonly Linter.LintMessage[];
}

/** Parses `code` as if it lived at `filePath` (relative to the repository root). Never runs it. */
export async function lintFixture(code: string, filePath: string): Promise<FixtureReport> {
  const [result] = await eslint.lintText(code, { filePath: resolve(ROOT, filePath) });
  return { messages: result?.messages ?? [] };
}

/** The configuration that applies to `filePath` once every block has been merged, in order. */
export async function resolveConfig(filePath: string): Promise<Linter.Config> {
  const config: unknown = await eslint.calculateConfigForFile(resolve(ROOT, filePath));
  if (typeof config !== "object" || config === null) {
    throw new Error(`No ESLint configuration applies to ${filePath}`);
  }
  return config;
}
