import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Cloned sites render the source media 1:1 (custom parallax/mask transforms, posters
    // swapped on first frame), so next/image optimisation would change the output.
    files: ["src/components/sites/**/*.{ts,tsx}"],
    rules: { "@next/next/no-img-element": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Research evidence (minified source bundle) and vendored three.js decoders.
    "docs/research/**",
    "public/**",
  ]),
]);

export default eslintConfig;
