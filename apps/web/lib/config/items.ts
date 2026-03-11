/**
 * Item configuration constants.
 * Centralized config for item-related constants and limits.
 */

/**
 * Maximum nesting depth for items.
 * Items can be nested from depth 0 (root) to depth 9 (10 levels total).
 * This prevents deeply nested hierarchies that can impact performance.
 */
export const MAX_ITEM_DEPTH = 10;
