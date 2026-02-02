/**
 * Mock for lib/rate-limit.ts
 * Prevents Upstash Redis and env imports in Storybook's browser build.
 */

import { fn } from "storybook/test";

/**
 * Mock rate limit result - always allows the request.
 */
const mockRateLimitResult = {
  success: true,
  limit: 100,
  remaining: 99,
  reset: Date.now() + 60000,
};

/**
 * Mock rate limiter that always succeeds.
 */
const createMockLimiter = () => ({
  limit: fn(async () => mockRateLimitResult),
});

/**
 * Mock rate limiters for different actions.
 */
export const rateLimiters = {
  signIn: createMockLimiter(),
  signUp: createMockLimiter(),
  forgotPassword: createMockLimiter(),
  passwordChange: createMockLimiter(),
  itemCreate: createMockLimiter(),
  itemPin: createMockLimiter(),
  itemUpdate: createMockLimiter(),
  itemDelete: createMockLimiter(),
  itemSearch: createMockLimiter(),
  userSearch: createMockLimiter(),
  publicItemSearch: createMockLimiter(),
  botCrawl: createMockLimiter(),
};

/**
 * Mock for checkRateLimit function - always allows the request.
 */
export const checkRateLimit = fn(
  async (): Promise<{ success: true } | { success: false; error: string }> => ({
    success: true,
  })
);

/**
 * Mock for getClientIP function.
 */
export const getClientIP = fn(async (): Promise<string> => "127.0.0.1");
