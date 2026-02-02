/**
 * Fumadocs source loader.
 * Creates the documentation source from MDX collections.
 */

import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

// Debug logging for Vercel deployment
console.log("[FUMADOCS] Loading source.ts");
console.log("[FUMADOCS] docs object:", typeof docs);
console.log("[FUMADOCS] docs keys:", docs ? Object.keys(docs) : "undefined");

const fumadocsSource = docs.toFumadocsSource();
console.log("[FUMADOCS] fumadocsSource:", typeof fumadocsSource);
console.log("[FUMADOCS] fumadocsSource files count:", fumadocsSource?.files?.length ?? "no files");

export const source = loader({
  baseUrl: "/docs",
  source: fumadocsSource,
});

console.log("[FUMADOCS] source.getPages() count:", source.getPages().length);
console.log("[FUMADOCS] source.generateParams():", source.generateParams());
