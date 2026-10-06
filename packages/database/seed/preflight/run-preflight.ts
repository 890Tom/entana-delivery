// Runs BEFORE seed/index.ts (`node seed/preflight/run-preflight.ts && node seed/index.ts`).
// A static import of a package that is not built fails before any line of the importing file
// runs, so the seed cannot explain it itself. This file imports nothing heavy, reads no
// environment variable and opens no connection.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  describeMissingArtifacts,
  findMissingArtifacts,
  readDefaultExportTarget,
} from "./find-missing-artifacts.ts";

// Known limit: only the presence of the entry file is checked. An existing but incomplete
// dist/ (an interrupted build) is not detected.
// The generated Prisma client is not checked: the seed talks to PostgreSQL with `pg` only.
const passwordHashDirectory = fileURLToPath(new URL("../../../password-hash/", import.meta.url));
const manifest: unknown = JSON.parse(
  readFileSync(path.join(passwordHashDirectory, "package.json"), "utf8"),
);
const target = readDefaultExportTarget(manifest);
if (target === undefined) {
  throw new TypeError("@entana/password-hash has no default target for its root export");
}

const missing = findMissingArtifacts(
  [
    {
      label: "the built output of @entana/password-hash",
      path: path.resolve(passwordHashDirectory, target),
    },
  ],
  existsSync,
);

if (missing.length > 0) {
  process.stderr.write(describeMissingArtifacts(missing));
  process.exit(1);
}
