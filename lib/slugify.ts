/**
 * Converts a string to a URL-safe slug for use in data-testid attributes.
 * Used by components to generate predictable, unique test IDs.
 *
 * @param text - The text to slugify
 * @returns Lowercase kebab-case string (e.g., "Star Wars" -> "star-wars")
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
