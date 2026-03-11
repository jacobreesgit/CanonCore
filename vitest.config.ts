import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/**", "hooks/**"],
    },
    server: {
      deps: {
        // next-auth is ESM and imports next/server without .js extension,
        // which fails under Node.js ESM resolution. Inlining lets Vite resolve it.
        inline: ["next-auth"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
