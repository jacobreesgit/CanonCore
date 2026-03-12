import baseConfig from "@canoncore/config/eslint.base";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  ...baseConfig,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "node_modules/**",
      "e2e/**",
      "temp/**",
      ".source/**",
      "playwright-report/**",
      "test-results/**",
      "storybook-static/**",
      "_payload-ref/**",
    ],
  },
];
