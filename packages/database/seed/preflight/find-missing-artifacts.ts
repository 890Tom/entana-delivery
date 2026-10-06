export interface RequiredArtifact {
  readonly label: string;
  readonly path: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// The file Node loads for `import "<package>"`: the `default` target of the root export.
export function readDefaultExportTarget(manifest: unknown): string | undefined {
  if (!isRecord(manifest) || !isRecord(manifest.exports)) return undefined;
  const rootExport = manifest.exports["."];
  if (!isRecord(rootExport)) return undefined;
  const target = rootExport.default;
  return typeof target === "string" ? target : undefined;
}

export function findMissingArtifacts(
  artifacts: readonly RequiredArtifact[],
  exists: (path: string) => boolean,
): RequiredArtifact[] {
  return artifacts.filter((artifact) => !exists(artifact.path));
}

// Labels only: an absolute path would show the user's machine and help nobody.
export function describeMissingArtifacts(missing: readonly RequiredArtifact[]): string {
  const labels = missing.map((artifact) => artifact.label).join(", ");
  return `The seed cannot start: missing ${labels}.\nRun \`pnpm build\` from the repository root, then run the seed again.\n`;
}
