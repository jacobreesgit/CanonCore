/**
 * Builds a BreadcrumbList JSON-LD object for structured data.
 * Used alongside existing JSON-LD on public pages.
 */

interface BreadcrumbEntry {
  name: string;
  url: string;
}

/**
 * Generates a BreadcrumbList schema.org object.
 *
 * @param entries - Ordered breadcrumb entries (first = root, last = current page)
 * @returns JSON-LD object ready for serialization
 */
export function buildBreadcrumbJsonLd(entries: BreadcrumbEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.url,
    })),
  };
}
