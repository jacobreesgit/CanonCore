import { defineConfig, mergeConfig } from "vitest/config";
import path from "path";
import baseConfig from "../../vitest.config";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: [path.resolve(__dirname, "./**/*.test.ts")],
      setupFiles: [path.resolve(__dirname, "./setup.ts")],
      // Run test files sequentially to avoid cleanup race conditions
      fileParallelism: false,
      // Run tests within a file sequentially
      sequence: {
        concurrent: false,
      },
    },
  })
);
