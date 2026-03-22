import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".artifacts/**",
    ".opencrab/**",
    "official-site/.next/**",
    "official-site/out/**",
    ".playwright-cli/**",
    "output/**",
    "tmp/**",
  ]),
]);

export default eslintConfig;
