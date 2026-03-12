/**
 * Shared bot patterns for robots.txt and proxy middleware.
 * Centralized bot lists to ensure consistency across the application.
 *
 * Maintained lists to check for updates:
 * - https://github.com/ai-robots-txt/ai.robots.txt
 * - https://github.com/monperrus/crawler-user-agents
 * - https://www.searchenginejournal.com/ai-crawler-user-agents-list/558130/
 * - https://datadome.co/bots/
 *
 * Last updated: 2026-01-30
 * Review frequency: Monthly or when new aggressive crawlers are detected
 */

/**
 * Aggressive AI scrapers and non-compliant bots to block.
 * These consume resources without providing value to the site.
 *
 * Categories:
 * - AI Training: Meta, OpenAI, Anthropic, etc.
 * - Non-compliant: Perplexity (known to ignore robots.txt)
 * - SEO Tools: Semrush, Ahrefs, etc. (block unless needed)
 */
export const BLOCKED_BOTS = [
  // Meta AI scrapers (training data collection)
  "meta-externalagent",
  "Meta-ExternalAgent",
  "FacebookBot",
  "facebookexternalhit",

  // Perplexity (known to ignore robots.txt and use stealth crawling)
  "PerplexityBot",

  // OpenAI scrapers
  "GPTBot", // Training data collection
  "ChatGPT-User", // ChatGPT browsing feature
  "OAI-SearchBot", // Search indexing for ChatGPT citations

  // Anthropic scrapers
  "anthropic-ai",
  "Claude-Web",
  "claudebot",

  // ByteDance scrapers
  "Bytespider",
  "ByteDance",

  // Other AI/ML scrapers
  "DeepSeekBot", // DeepSeek AI
  "CCBot", // Common Crawl (used by many AI companies)
  "cohere-ai", // Cohere AI training
  "Diffbot", // Web data extraction
  "ImagesiftBot", // Image scraping
  "Omgilibot", // Content scraping
  "omgili", // Alternative spelling
  "YouBot", // You.com AI search
  "AI2Bot", // Allen Institute for AI
  "Applebot-Extended", // Apple AI training (separate from Applebot)
  "Google-Extended", // Google AI training (separate from Googlebot)
  "img2dataset", // Dataset creation tool
  "PiplBot", // People search engine

  // SEO/Marketing Tools (block unless specifically needed)
  "SemrushBot", // SEO research
  "AhrefsBot", // Backlink analysis
  "MJ12bot", // Majestic SEO
  "DotBot", // Moz crawler

  // General scrapers
  "Amazonbot", // Amazon web scraping
  "peer39_crawler", // Ad verification
] as const;

/**
 * Beneficial crawlers to allow (search engines that drive traffic).
 * These bots should be rate-limited but not blocked.
 */
export const ALLOWED_BOTS = [
  "Googlebot", // Google Search
  "Bingbot", // Bing Search
  "Applebot", // Apple Search/Siri/Spotlight (not Applebot-Extended)
  "DuckDuckBot", // DuckDuckGo Search
  "Slurp", // Yahoo Search
  "Yandex", // Yandex Search (Russia)
  "Baiduspider", // Baidu Search (China)
] as const;

/**
 * Regex patterns for proxy middleware (case-insensitive).
 * Pre-compiled patterns for performance.
 */
export const BLOCKED_BOT_PATTERNS = BLOCKED_BOTS.map(
  (bot) => new RegExp(bot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
);

/**
 * Regex patterns for beneficial bots (case-insensitive).
 * Pre-compiled patterns for performance.
 */
export const ALLOWED_BOT_PATTERNS = ALLOWED_BOTS.map(
  (bot) => new RegExp(bot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
);

/**
 * Common browser user-agent patterns for fast-path optimization.
 * These represent 99%+ of legitimate traffic.
 */
export const COMMON_BROWSER_PATTERN =
  /chrome|firefox|safari|edge|opera|brave|vivaldi/i;

/**
 * Pattern to detect anything that looks like a bot.
 * Used as secondary check to avoid false positives.
 */
export const BOT_INDICATOR_PATTERN = /bot|crawler|spider|scraper|http/i;

/**
 * TypeScript types for bot categories.
 */
export type BlockedBot = (typeof BLOCKED_BOTS)[number];
export type AllowedBot = (typeof ALLOWED_BOTS)[number];
