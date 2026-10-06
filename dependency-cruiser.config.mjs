// Enforces the dependency direction of docs/engineering-standards.md, section 4.
// Run with `pnpm lint:architecture`. A violation fails the command (and the CI job).
//
//   packages/contracts (pure)  ->  used by packages/database, apps/api and the front ends
//   packages/password-hash (pure leaf)  ->  used by packages/database (seed) and apps
//   apps never import each other; only apps/api and packages/database know the database.
//   shipped code never imports test code.

const TEST_FILES = "\\.test\\.(ts|tsx)$|^(apps|packages)/[^/]+/tests/";
const NPM_TYPES = [
  "npm",
  "npm-dev",
  "npm-peer",
  "npm-optional",
  "npm-no-pkg",
  "npm-unknown",
  "unknown",
];

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      comment: "A circular dependency makes modules impossible to load, test or move alone.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolvable-import",
      comment:
        "An import that cannot be resolved is a typo or a missing dependency, and hides the real target from the other rules.",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "contracts-no-repo-imports",
      comment:
        "packages/contracts is pure: it imports nothing from other packages or applications.",
      severity: "error",
      from: { path: "^packages/contracts/src" },
      to: { path: "^(apps|packages/(?!contracts/))|^@entana/" },
    },
    {
      name: "password-hash-no-repo-imports",
      comment:
        "packages/password-hash is a leaf: it imports no application and no other workspace package, and only Node's own modules.",
      severity: "error",
      from: { path: "^packages/password-hash/src", pathNot: TEST_FILES },
      to: { path: "^(apps|packages/(?!password-hash/))|^@entana/" },
    },
    {
      name: "contracts-no-framework-or-database-library",
      comment:
        "packages/contracts only depends on Zod: no framework and no database library (tests may use Vitest).",
      severity: "error",
      from: { path: "^packages/contracts/src", pathNot: TEST_FILES },
      to: { dependencyTypes: NPM_TYPES, pathNot: "node_modules/zod/|^zod$" },
    },
    {
      name: "production-code-does-not-import-tests",
      comment:
        "Test support code (for example the test-only routes of the API) must never be reachable from the shipped code.",
      severity: "error",
      from: { path: "^(apps|packages)/[^/]+/src/", pathNot: TEST_FILES },
      to: { path: TEST_FILES },
    },
    {
      name: "packages-no-app-imports",
      comment: "Dependencies point towards the packages, never towards an application.",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "apps-do-not-import-each-other",
      comment: "Applications share code only through packages.",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/([^/]+)/", pathNot: "^apps/$1/" },
    },
    {
      name: "only-api-uses-database",
      comment:
        "The front ends never import packages/database nor a database library: only apps/api does.",
      severity: "error",
      from: { path: "^apps/", pathNot: "^apps/api/" },
      to: {
        path: "^packages/database/|^@entana/database|node_modules/(@prisma|prisma|pg)/|^(@prisma/client|prisma|pg)$",
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(generated|coverage|dist)/" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      // "types" first: a package that publishes compiled JavaScript (contracts) is analysed
      // through its TypeScript source, so that the check does not depend on a build.
      conditionNames: ["types", "import", "require", "node", "default"],
    },
    moduleSystems: ["es6", "cjs"],
    reporterOptions: { text: { highlightFocused: true } },
  },
};
