/**
 * Dynamic robots.txt generation for crawler management.
 * Blocks aggressive AI scrapers while allowing beneficial search engines.
 *
 * Based on best practices from:
 * - https://darkvisitors.com (bot documentation)
 * - https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers
 * - https://github.com/ai-robots-txt/ai.robots.txt (maintained bot list)
 *
 * Note: robots.txt is advisory only. Some crawlers (like Perplexity) are known
 * to ignore it. Edge-level blocking in proxy.ts provides enforcement.
 */

import type { MetadataRoute } from "next";
import { BLOCKED_BOTS, ALLOWED_BOTS } from "@/lib/bot-patterns";

/**
 * Generate robots.txt dynamically.
 * Blocks AI scrapers while allowing search engines that drive traffic.
 *
 * @returns Robots configuration with rules for different bot types
 *
 * @example
 * // Generated robots.txt output:
 * // User-agent: Googlebot
 * // Allow: /
 * // Crawl-delay: 1
 * //
 * // User-agent: GPTBot
 * // Disallow: /
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Allow beneficial search engines with polite crawl delay
      {
        userAgent: [...ALLOWED_BOTS],
        allow: "/",
        // Polite crawl delay (1 second between requests)
        // Helps prevent server overload while allowing indexing
        crawlDelay: 1,
      },
      // Block aggressive AI scrapers
      {
        userAgent: [...BLOCKED_BOTS],
        disallow: "/",
      },
      // Default rule for unlisted bots (conservative approach)
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
        // More restrictive delay for unknown bots
        crawlDelay: 2,
      },
    ],
    // Sitemap for search engine indexing
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || "https://canoncore.com"}/sitemap.xml`,
  };
}
