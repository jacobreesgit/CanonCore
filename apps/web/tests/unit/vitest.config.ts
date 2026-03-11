import { defineConfig, mergeConfig } from "vitest/config";
import path from "path";
import baseConfig from "../../vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [path.resolve(__dirname, "./**/*.test.{ts,tsx}")],
      setupFiles: [path.resolve(__dirname, "./setup.ts")],
      environment: "jsdom",
    },
  })
);
