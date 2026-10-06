import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import { defineConfig } from "eslint/config";
import checkFile from "eslint-plugin-check-file";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const DATABASE_MESSAGE =
  "Only packages/database may use the database driver or Prisma. Import from @entana/database.";

// `no-restricted-imports` cannot see `import("pg")`, so this selector covers it. The class after
// the name keeps `pg-boss`, `pgx` and `@prismatic/x` out: only `pg`, `pg/...`, `prisma`, `prisma/...`
// and `@prisma/...` match.
const DYNAMIC_DATABASE_IMPORT = {
  selector: "ImportExpression[source.value=/^(pg|prisma|@prisma)([^a-zA-Z0-9_-]|$)/]",
  message: DATABASE_MESSAGE,
};

const DEFAULT_EXPORT = {
  selector: "ExportDefaultDeclaration, ExportSpecifier[exported.name='default']",
  message:
    "No default exports: use a named export (only the configuration files listed below may have one).",
};

export default defineConfig(
  // Files that are never linted.
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/generated/**",
      "**/node_modules/**",
    ],
  },

  // Base rules for JavaScript, then strict and stylistic rules that use type information.
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    // A disable comment that no longer silences anything is itself an error.
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      parserOptions: {
        // Finds the nearest tsconfig.json of each file automatically.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Imports used only as types must say so (works with verbatimModuleSyntax).
      "@typescript-eslint/consistent-type-imports": "error",
      // Allow unused parameters that start with an underscore.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },

  // Naming (engineering standards, section 3).
  {
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["camelCase"], leadingUnderscore: "allow" },
        { selector: "import", format: null },
        // Keys of object literals and types follow external shapes (database columns, HTTP).
        { selector: ["objectLiteralProperty", "typeProperty", "enumMember"], format: null },
        // UPPER_SNAKE_CASE is for module-level constants only, never for mutable state.
        {
          selector: "variable",
          modifiers: ["const", "global"],
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "function", format: ["camelCase"] },
        {
          selector: ["variable", "parameter", "classProperty", "parameterProperty"],
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "can"],
          leadingUnderscore: "allow",
        },
      ],
    },
  },

  // Size and complexity (section 4). Blank lines and comments do not count.
  {
    rules: {
      complexity: ["error", 10],
      "max-params": ["error", 4],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
    },
  },

  // Safety (section 2). `any` and `!` are already errors in strictTypeChecked.
  {
    plugins: { "@eslint-community/eslint-comments": eslintComments },
    rules: {
      "no-console": "error",
      "no-restricted-syntax": ["error", DEFAULT_EXPORT, DYNAMIC_DATABASE_IMPORT],
      // Static imports, type-only imports and re-exports. packages/database is exempted below.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["pg", "pg/**", "prisma", "prisma/**", "@prisma/**"],
              message: DATABASE_MESSAGE,
            },
          ],
        },
      ],
      "@eslint-community/eslint-comments/require-description": "error",
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "@eslint-community/eslint-comments/disable-enable-pair": "error",
    },
  },

  // File names are kebab-case: `order-status.ts`, `order-status.test.ts`.
  {
    files: ["**/*.{ts,tsx,mjs,js,cjs}"],
    plugins: { "check-file": checkFile },
    rules: {
      "check-file/filename-naming-convention": [
        "error",
        { "**/*.{ts,tsx,mjs,js,cjs}": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],
    },
  },

  // Tools and frameworks that read a default export from their configuration file.
  // Add a framework's own file here (for example a route module) when one requires it.
  {
    files: ["**/*.config.{ts,mjs,js,cjs}"],
    rules: { "no-restricted-syntax": ["error", DYNAMIC_DATABASE_IMPORT] },
  },

  // The single owner of the database driver and Prisma (ADR 0005). Same path as the
  // `only-database-package-uses-database-libraries` rule of dependency-cruiser.config.mjs.
  {
    files: ["packages/database/**/*.{ts,tsx,mjs,js,cjs}"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": ["error", DEFAULT_EXPORT],
    },
  },
  {
    files: ["packages/database/**/*.config.{ts,mjs,js,cjs}"],
    rules: { "no-restricted-syntax": "off" },
  },

  // NestJS modules are classes with no member: the `@Module()` decorator is all they have.
  // Only a decorated class is allowed to be empty, and only in the API.
  {
    files: ["apps/api/**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
    },
  },

  // A test file groups many cases in one `describe` callback, so only that limit is lifted.
  {
    files: ["**/*.test.ts", "**/tests/**/*.ts"],
    rules: { "max-lines-per-function": "off" },
  },

  // Plain JavaScript files (like this one) are not part of a TypeScript project:
  // type-aware rules are switched off for them.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off the formatting rules that would fight with Prettier.
  prettier,
);
