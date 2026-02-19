/**
 * Storybook main configuration file.
 * Configures stories glob patterns, addons, framework settings, and TypeScript options.
 *
 * Uses webpack aliases to mock Node.js-only modules (googleapis, sharp) that fail
 * in Storybook's browser build. See .storybook/mocks/ for mock implementations.
 */
import type { StorybookConfig } from "@storybook/nextjs";
import { fileURLToPath } from "url";
import webpack from "webpack";

/**
 * Resolves a relative path to an absolute filesystem path.
 * Uses import.meta.resolve() and converts the file:// URL to a path.
 */
function resolveMock(relativePath: string): string {
  return fileURLToPath(import.meta.resolve(relativePath));
}

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "storybook/viewport",
    "msw-storybook-addon",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
  staticDirs: ["../public"],
  core: {
    disableProjectJson: true,
  },
  typescript: {
    check: false,
    reactDocgen: false,
  },
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Mock Node.js-only modules to prevent build failures
        // googleapis: Imports child_process which fails in browser
        // sharp: Native binary that can't run in browser
        //
        // The $ suffix ensures exact module matching (not prefix matching)
        "@/lib/google-drive-client$": resolveMock(
          "./mocks/google-drive-client.mock.ts"
        ),
        "@/lib/google-drive-sync$": resolveMock(
          "./mocks/google-drive-sync.mock.ts"
        ),
        "@/lib/google-drive-upload$": resolveMock(
          "./mocks/google-drive-upload.mock.ts"
        ),
        "@/lib/google-drive-actions$": resolveMock(
          "./mocks/google-drive-actions.mock.ts"
        ),
        "@/lib/item-actions$": resolveMock("./mocks/item-actions.mock.ts"),
        "@/lib/playlist-actions$": resolveMock(
          "./mocks/playlist-actions.mock.ts"
        ),
        "@/lib/user-actions$": resolveMock("./mocks/user-actions.mock.ts"),
        "@/lib/auth$": resolveMock("./mocks/auth.mock.ts"),
        "@/lib/prisma$": resolveMock("./mocks/prisma.mock.ts"),
        "@/lib/rate-limit$": resolveMock("./mocks/rate-limit.mock.ts"),
        "@/lib/email$": resolveMock("./mocks/email.mock.ts"),
        "@/lib/env$": resolveMock("./mocks/env.mock.ts"),
        "@/lib/sync-log$": resolveMock("./mocks/sync-log.mock.ts"),
        "@/lib/tmdb-actions$": resolveMock("./mocks/tmdb-actions.mock.ts"),
      };

      // Fallback Node.js core modules to empty stubs for browser build
      // These are required when native modules (sharp, googleapis) leak through
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        net: false,
        tls: false,
        http2: false,
        dns: false,
        os: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        url: false,
        assert: false,
        zlib: false,
        querystring: false,
        http: false,
        https: false,
        events: false,
        process: false,
      };
    }

    // Inject TMDB_API_KEY into the browser bundle for story loaders
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        "process.env.STORYBOOK_TMDB_API_KEY": JSON.stringify(
          process.env.TMDB_API_KEY ?? ""
        ),
      })
    );

    // Add plugin to rewrite node: protocol imports to bare module names
    // This allows them to hit the fallback configuration above
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^node:/,
        (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }
      )
    );

    // Replace server-only modules at the webpack resolution level
    // NormalModuleReplacementPlugin catches imports regardless of path alias resolution
    // This is more reliable than webpack aliases which depend on resolution order
    const serverModuleMocks = [
      // Google Drive modules (import googleapis which uses Node.js-only jws/streams)
      ["google-drive-client", "./mocks/google-drive-client.mock.ts"],
      ["google-drive-sync", "./mocks/google-drive-sync.mock.ts"],
      ["google-drive-upload", "./mocks/google-drive-upload.mock.ts"],
      ["google-drive-actions", "./mocks/google-drive-actions.mock.ts"],
      // Server action modules (import prisma, sharp, or chain to googleapis)
      ["item-actions", "./mocks/item-actions.mock.ts"],
      ["playlist-actions", "./mocks/playlist-actions.mock.ts"],
      ["user-actions", "./mocks/user-actions.mock.ts"],
      ["tmdb-actions", "./mocks/tmdb-actions.mock.ts"],
      // Core server modules
      ["auth", "./mocks/auth.mock.ts"],
      ["prisma", "./mocks/prisma.mock.ts"],
      ["rate-limit", "./mocks/rate-limit.mock.ts"],
      ["email", "./mocks/email.mock.ts"],
      ["env", "./mocks/env.mock.ts"],
      ["sync-log", "./mocks/sync-log.mock.ts"],
    ] as const;

    for (const [moduleName, mockPath] of serverModuleMocks) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          new RegExp(`lib/${moduleName}(\\.ts)?$`),
          resolveMock(mockPath)
        )
      );
    }

    return config;
  },
};

export default config;
