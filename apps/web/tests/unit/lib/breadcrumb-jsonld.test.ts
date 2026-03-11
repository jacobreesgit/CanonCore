import { describe, it, expect } from "vitest";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumb-jsonld";

describe("buildBreadcrumbJsonLd", () => {
  it("builds a BreadcrumbList with correct positions", () => {
    const result = buildBreadcrumbJsonLd([
      { name: "Home", url: "https://canoncore.com" },
      { name: "johndoe", url: "https://canoncore.com/u/johndoe" },
      { name: "Movies", url: "https://canoncore.com/u/johndoe/abc123" },
    ]);

    expect(result["@context"]).toBe("https://schema.org");
    expect(result["@type"]).toBe("BreadcrumbList");
    expect(result.itemListElement).toHaveLength(3);
    expect(result.itemListElement[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://canoncore.com",
    });
    expect(result.itemListElement[2]).toEqual({
      "@type": "ListItem",
      position: 3,
      name: "Movies",
      item: "https://canoncore.com/u/johndoe/abc123",
    });
  });

  it("handles single entry", () => {
    const result = buildBreadcrumbJsonLd([
      { name: "Home", url: "https://canoncore.com" },
    ]);

    expect(result.itemListElement).toHaveLength(1);
    expect(result.itemListElement[0].position).toBe(1);
  });

  it("handles empty entries", () => {
    const result = buildBreadcrumbJsonLd([]);
    expect(result.itemListElement).toHaveLength(0);
  });
});
