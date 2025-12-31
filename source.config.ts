/**
 * Fumadocs MDX source configuration.
 * Defines the content directory for documentation.
 */

import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
