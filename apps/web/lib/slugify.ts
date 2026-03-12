/**
 * Converts a string to a URL-safe kebab-case slug.
 * Used by components to generate predictable data-testid attributes
 * and by E2E page objects to locate elements by slugified names.
 *
 * @param text - The input string to slugify
 * @returns A lowercase kebab-case slug
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
