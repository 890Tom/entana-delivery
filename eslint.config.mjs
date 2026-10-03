import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  // Files that are never linted.
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/.turbo/**", "**/node_modules/**"],
  },

  // Base rules for JavaScript, then strict and stylistic rules that use type information.
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
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
