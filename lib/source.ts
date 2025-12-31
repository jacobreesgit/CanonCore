/**
 * Fumadocs source loader.
 * Creates the documentation source from MDX collections.
 */

import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
