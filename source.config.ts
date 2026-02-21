/**
 * Fumadocs MDX source configuration.
 * Defines the content directories for documentation and legal pages.
 */

import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export const legal = defineDocs({
  dir: "content/legal",
});

export default defineConfig();
