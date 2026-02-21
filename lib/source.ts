/**
 * Fumadocs source loader.
 * Creates the documentation and legal sources from MDX collections.
 */

import { docs, legal } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export const legalSource = loader({
  baseUrl: "/legal",
  source: legal.toFumadocsSource(),
});
