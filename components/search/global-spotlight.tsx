/**
 * Global spotlight search wrapper.
 * Renders at layout level to provide search across all protected pages.
 */

"use client";

import { SpotlightSearch } from "./spotlight-search";

/**
 * Renders the global spotlight search dialog.
 * Should be placed in the protected routes layout.
 */
export function GlobalSpotlight() {
  return <SpotlightSearch />;
}
