import js from "@eslint/js";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import { defineConfig } from "eslint/config";
import checkFile from "eslint-plugin-check-file";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
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

const RESTRICTED_SYNTAX = [DEFAULT_EXPORT, DYNAMIC_DATABASE_IMPORT];

// HTML injection in the front end (apps/client). Layers: these selectors and
// `no-restricted-properties` catch the literal, visible forms. untrusted-text.test.tsx only
// documents the safe pattern (React escapes `{value}`); it does not test real components, so
// each component that shows customer or server text needs its own test. A strict
// Content-Security-Policy at deployment and the review of third-party libraries cover what a
// static rule cannot see: computed property names, URLs held in variables, props spread onto
// elements ({...props}), aliases of `document`, libraries that inject HTML themselves, and
// dynamic imports.
// Reading `innerHTML` is not an injection, so only assignments are refused.
const RENDER_TEXT_ADVICE = "Render text through React ({value}), never as HTML.";
const URL_ATTRIBUTES = "/^(href|src|action|formAction|xlinkHref|data)$/";
const DANGEROUS_URL = "/^\\s*(javascript|data|vbscript):/i";
const HTML_INJECTION_SYNTAX = [
  {
    selector:
      "JSXAttribute[name.name='dangerouslySetInnerHTML'], Property[key.name='dangerouslySetInnerHTML'], Property[key.value='dangerouslySetInnerHTML']",
    message: `dangerouslySetInnerHTML is forbidden (JSX, createElement and plain objects). ${RENDER_TEXT_ADVICE}`,
  },
  {
    selector:
      "AssignmentExpression[left.type='MemberExpression'][left.property.name=/^(innerHTML|outerHTML|srcdoc)$/], AssignmentExpression[left.type='MemberExpression'][left.property.value=/^(innerHTML|outerHTML|srcdoc)$/]",
    message: `Assigning innerHTML, outerHTML or srcdoc is forbidden. ${RENDER_TEXT_ADVICE}`,
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(write|writeln)$/][callee.object.property.name='document']",
    message: `window.document.write and writeln write raw HTML into the page. ${RENDER_TEXT_ADVICE}`,
  },
  {
    selector: "JSXAttribute[name.name=/^srcDoc$/i]",
    message: `srcDoc is forbidden: it embeds a whole HTML document. ${RENDER_TEXT_ADVICE}`,
  },
  {
    selector: `JSXAttribute[name.name=${URL_ATTRIBUTES}] > Literal[value=${DANGEROUS_URL}], JSXAttribute[name.name=${URL_ATTRIBUTES}] > JSXExpressionContainer > Literal[value=${DANGEROUS_URL}], JSXAttribute[name.name=${URL_ATTRIBUTES}] > JSXExpressionContainer > TemplateLiteral > TemplateElement[value.cooked=${DANGEROUS_URL}]`,
    message: `javascript:, data: and vbscript: URLs are forbidden in href, src and action. Use an https: or relative URL.`,
  },
];
const HTML_INJECTION_PROPERTIES = [
  ...[
    "insertAdjacentHTML",
    "createContextualFragment",
    "setHTMLUnsafe",
    "parseHTMLUnsafe",
    "setHTML",
  ].map((property) => ({
    property,
    message: `${property} parses a string as HTML. ${RENDER_TEXT_ADVICE}`,
  })),
  ...["write", "writeln"].map((property) => ({
    object: "document",
    property,
    message: `document.${property} writes raw HTML into the page. ${RENDER_TEXT_ADVICE}`,
  })),
];

// Naming (engineering standards, section 3). Shared by the global rule and by the React override.
const NAMING_RULES = [
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
];

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
      "@typescript-eslint/naming-convention": ["error", ...NAMING_RULES],
    },
  },

  // React components are functions named in PascalCase. Only the front end's .tsx files may do
  // this: a component is a function declaration, so a PascalCase variable is still refused.
  {
    files: ["apps/client/**/*.tsx"],
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        ...NAMING_RULES.map((rule) =>
          rule.selector === "function" ? { ...rule, format: ["camelCase", "PascalCase"] } : rule,
        ),
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
      "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX],
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

  // Front end: hooks correctness, and no way to inject HTML or evaluate strings as code.
  // Test files get exactly the same rules: a test must not call these APIs either. Only the
  // `max-lines-per-function` exemption below applies to them.
  // `no-restricted-syntax` replaces the global list, so the shared entries are spread again.
  {
    files: ["apps/client/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  {
    files: ["apps/client/**/*.{ts,tsx}"],
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-syntax": ["error", ...RESTRICTED_SYNTAX, ...HTML_INJECTION_SYNTAX],
      "no-restricted-properties": ["error", ...HTML_INJECTION_PROPERTIES],
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
    files: ["**/*.test.{ts,tsx}", "**/tests/**/*.{ts,tsx}"],
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
