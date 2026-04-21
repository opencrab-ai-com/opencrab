import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "desktop/**/*.cjs",
      "lib/runtime/runtime-network-config.shared.js",
      "skills/**/*.cjs",
      "skills/**/*.js",
    ],
    languageOptions: {
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".artifacts/**",
    ".opencrab/**",
    ".opencrab-desktop/**",
    "official-site/.next/**",
    "official-site/out/**",
    ".playwright-cli/**",
    "dist/**",
    "output/**",
    "tmp/**",
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
