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

  // Item rate limiters (generous - normal user operations)
  itemCreate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:item:create",
  }),
  itemUpdate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:item:update",
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
