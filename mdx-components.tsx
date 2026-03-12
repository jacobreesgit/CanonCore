/**
 * MDX components configuration for Fumadocs.
 * Provides default styling for MDX content.
 */

import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

/**
 * Returns MDX components with Fumadocs defaults.
 *
 * @param components - Optional custom components to merge
 * @returns Combined MDX components
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
