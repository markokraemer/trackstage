//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    // Interior.dev registry files reference jsx-a11y rules our config doesn't
    // ship; scoped override instead of installing a plugin for vendored code.
    files: ["src/components/interior/**"],
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/naming-convention": "off",
    },
  },
  {
    // AI Elements (registry.ai-sdk.dev) — vendored the same way as
    // src/components/interior/**: upstream style, re-pulled by
    // `shadcn add`, so we don't hand-edit it into our house rules.
    files: ["src/components/ai-elements/**"],
    rules: {
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/method-signature-style": "off",
      "import/consistent-type-specifier-style": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    ignores: [
      "eslint.config.js",
      ".prettierrc",
      "convex/_generated/**",
      "tests/e2e/.results/**",
    ],
  },
]
