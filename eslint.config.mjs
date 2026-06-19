import { fixupPluginRules } from "@eslint/compat";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";
import unusedImports from "eslint-plugin-unused-imports";
import tailwindcss from "eslint-plugin-tailwindcss";

const config = tseslint.config(
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    plugins: {
      react: fixupPluginRules(reactPlugin),
      "react-hooks": fixupPluginRules(reactHooksPlugin),
      import: fixupPluginRules(importPlugin),
      "jsx-a11y": fixupPluginRules(jsxA11yPlugin),
      "@next/next": nextPlugin,
      "unused-imports": unusedImports,
      tailwindcss: tailwindcss,
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
      tailwindcss: {
        cssConfigPath: "app/globals.css",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          "vars": "all",
          "varsIgnorePattern": "^_",
          "args": "after-used",
          "argsIgnorePattern": "^_",
        },
      ],
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
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
    files: ["components/members/MemberCard.tsx", "components/feed/MessageCard.tsx"],
    "rules": {
      "no-restricted-syntax": [
        "error",
        {
          "selector": "JSXAttribute[name.name='className'][value.type='Literal']",
          "message": "Tailwind classes must be variables. Raw string literals are not allowed in className."
        },
        // Catch strings inside cn(): className={cn(..., "text-sm")}
        {
          "selector": "JSXAttribute[name.name='className'] CallExpression[callee.name='cn'] > Literal",
          "message": "Raw string literals are not allowed inside the cn() utility. Use a TW variable instead."
        }
      ],
      "tailwindcss/no-custom-classname": ["error", {
        "whitelist": ["my-custom-class", "glides-.*"], // Accepts exact names or regular expressions
      }]
    }
  },
  // *************** ATTEMPT TO ADD ESLINT RULE FOR ONLY TAILWIND FOR CLASSNAME-CONSTANTS MAKES EITHER NOTHING OR EVERYTHING AN ERROR ***************
  // {
  //   files: ["lib/classname-constants.ts"],
  //   plugins: {
  //     tailwindcss: tailwindcss,
  //     local: {
  //       rules: {
  //         "deep-tailwind-validate": {
  //           meta: {
  //             type: "problem",
  //             docs: { description: "Validates all atomic strings in the constants file against Tailwind rules." },
  //             schema: [],
  //           },
  //           create(context) {
  //             // Instantiate the native Tailwind class validator engine
  //             const tailwindRule = tailwindcss.rules["no-custom-classname"];
  //             const tailwindRuleInstance = tailwindRule.create(context);

  //             return {
  //               // 1. Catches standard standalone strings: "absolute", "flex"
  //               Literal(node) {
  //                 if (typeof node.value === "string") {
  //                   tailwindRuleInstance.Literal(node);
  //                 }
  //               },
  //               // 2. Catches raw text blocks inside backticks: `flex items-center`
  //               TemplateElement(node) {
  //                 // This safely evaluates only the text segments and skips ${expressions}
  //                 tailwindRuleInstance.TemplateElement(node);
  //               }
  //             };
  //           }
  //         }
  //       }
  //     }
  //   },
  //   settings: {
  //     tailwindcss: {
  //       cssConfigPath: "app/globals.css", // Ensure this points exactly to your Tailwind CSS entry point
  //     },
  //   },
  //   rules: {
  //     "local/deep-tailwind-validate": "error"
  //   }
  // },
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
      // Hackathon submission folders are independent contributor projects
      // (own package.json, own path aliases). Don't lint/type-check them as
      // part of the root project — the root tsconfig excludes them too.
      "sports-hack-2026-submissions/**",
      "pydata-2026-submissions/**",
      "hack-a-sprint-2026-submissions/**",
    ],
  },
);

export default config;
