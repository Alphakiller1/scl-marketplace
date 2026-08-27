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
  ]),
  {
    rules: {
      // Honour the leading-underscore convention this codebase already uses.
      //
      // `resolveStorefrontIdentity({ displayName: _displayName, ... })` destructures
      // a field precisely so it is EXCLUDED from a rest spread, and
      // `identityDisplayLinesForCapper(capper, _opts)` keeps a parameter to hold
      // a call signature. Both are deliberate, both were reported as warnings, and
      // neither can be "fixed" without changing behaviour — so the lint output
      // carried two entries that no one could ever act on. A gate that is never
      // clean is a gate people stop reading.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
