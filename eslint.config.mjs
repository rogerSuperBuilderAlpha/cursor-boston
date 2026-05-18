import { fixupPluginRules } from "@eslint/compat";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

const config = tseslint.config(
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    plugins: {
      react: fixupPluginRules(reactPlugin),
      "react-hooks": fixupPluginRules(reactHooksPlugin),
      import: fixupPluginRules(importPlugin),
      "jsx-a11y": fixupPluginRules(jsxA11yPlugin),
      "@next/next": nextPlugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "18" },
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".mts", ".cts", ".tsx", ".d.ts"],
      },
      "import/resolver": {
        node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // Accessibility (jsx-a11y) — promoted to `error` per OSS-review Phase 5.1.9.
      // ACCESSIBILITY.md commits the project to WCAG 2.1 AA; advisory `warn`
      // rules conflict with that commitment. The rules below either catch
      // real bugs or enforce semantic markup that the codebase already
      // honors. Newly-added rules from the May 2026 review are staged at
      // `warn` first so the build doesn't break on legacy components; ratchet
      // each to `error` as the corresponding sweep PR lands.
      "jsx-a11y/alt-text": [
        "error",
        { elements: ["img"], img: ["Image"] },
      ],
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      // Newly added — staged at `warn` for the legacy-component sweep,
      // ratchet to `error` per Phase 5 backlog (see REVIEW_ACTION_PLAN.md).
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/no-redundant-roles": "warn",
      "jsx-a11y/tabindex-no-positive": "warn",
      "jsx-a11y/heading-has-content": "warn",
      "jsx-a11y/media-has-caption": "warn",
      "react/jsx-no-target-blank": "off",
      // eslint-plugin-react-hooks 7.1 promoted several React Compiler-driven
      // checks into recommended as errors. They flag ~40 pre-existing idiomatic
      // patterns (data-fetch effects, derived memoization) across feature code.
      // Keep them visible as warnings so develop stays green while they are
      // addressed incrementally.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { sourceType: "module" },
    },
  },
  {
    // Test files use mock `next/image` shims that render a bare <img>;
    // alt-text and other a11y rules don't apply to test mocks. Keep
    // these as advisory in tests rather than blocking.
    files: ["__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}", "e2e/**/*.{ts,tsx}"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
    ],
  },
);

export default config;
