/**
 * Rate limiting utilities using Upstash Redis.
 * Protects auth endpoints from brute force attacks and prevents API abuse.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { env } from "@/lib/env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Rate limiters for different actions.
 * Auth actions have conservative limits, authenticated operations are more generous.
 */
export const rateLimiters = {
  // Auth rate limiters (strict - prevent brute force)
  signIn: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "ratelimit:signin",
  }),
  signUp: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "1 m"),
    prefix: "ratelimit:signup",
  }),
  forgotPassword: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(2, "1 m"),
    prefix: "ratelimit:forgot",
  }),
  passwordChange: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "ratelimit:password-change",
  }),
  profileUpdate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "ratelimit:profile-update",
  }),
  imageUpload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "ratelimit:image-upload",
  }),

  // Item rate limiters (generous - normal user operations)
  itemCreate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:item:create",
  }),
  itemPin: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:item:pin",
  }),
  itemUpdate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:item:update",
  }),
  itemDelete: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:item:delete",
  }),
  itemSearch: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:item:search",
  }),

  // TMDB rate limiters
  tmdbSearch: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:tmdb:search",
  }),
  tmdbPreview: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "ratelimit:tmdb:preview",
  }),
  tmdbBackdrop: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "ratelimit:tmdb:backdrop",
  }),
  tmdbImages: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(15, "1 m"),
    prefix: "ratelimit:tmdb:images",
  }),

  // Public profile rate limiters
  usernameCheck: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:username:check",
  }),
  fork: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "ratelimit:fork",
  }),
  publicProfile: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:public:profile",
  }),
  explore: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:explore",
  }),

  // API route rate limiters (IP-based)
  apiRoute: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:api:route",
  }),

  // Public search rate limiters
  userSearch: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:user:search",
  }),
  publicItemSearch: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:public:item:search",
  }),

  /**
   * Bot crawler rate limiter for beneficial search engines.
   *
   * Used by proxy middleware to rate-limit beneficial bots (Google, Bing, etc.)
   * that drive traffic while preventing cost overruns from aggressive crawling.
   *
   * Limit: 120 requests/minute (2 req/sec)
   * - Google recommends not limiting Googlebot unless server load issues
   * - Typical Googlebot crawl rate: 5-10 req/sec (300-600 req/min)
   * - Our limit allows proper indexing while protecting against abuse
   *
   * Key composition: IP + user-agent (prevents single bot with multiple IPs)
   *
   * References:
   * - https://developers.google.com/crawling/docs/crawlers-fetchers/reduce-crawl-rate
   * - https://www.searchenginejournal.com/ai-crawler-user-agents-list/558130/
   */
  botCrawl: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    prefix: "ratelimit:bot:crawl",
  }),
};

/**
 * Checks rate limit for an action. Returns error if exceeded.
 * Bypassed when BYPASS_RATE_LIMIT env var is set (for E2E tests).
 *
 * @param action - Which rate limiter to use
 * @returns null if allowed, error object if rate limited
 */
export async function checkRateLimit(
  action: keyof typeof rateLimiters
): Promise<{ error: string } | null> {
  // Use process.env directly for BYPASS_RATE_LIMIT since it's a test flag
  // that may be modified at runtime via vi.stubEnv
  if (process.env.BYPASS_RATE_LIMIT === "true") {
    return null;
  }

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "127.0.0.1";

  const { success } = await rateLimiters[action].limit(ip);

  if (!success) {
    return { error: "Too many attempts. Please try again later." };
  }
  return null;
}
