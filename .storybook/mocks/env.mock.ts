/**
 * Mock for lib/env.ts
 * Provides fake environment variables for Storybook's browser build.
 */

export const env = {
  DATABASE_URL: "postgresql://mock:mock@localhost:5432/mock",
  AUTH_SECRET: "mock-auth-secret-for-storybook",
  RESEND_API_KEY: "re_mock_api_key",
  EMAIL_FROM: "noreply@example.com",
  NEXT_PUBLIC_APP_URL: "http://localhost:6006",
  UPSTASH_REDIS_REST_URL: "https://mock-redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "mock-redis-token",
  ENCRYPTION_KEY: "bW9jay1lbmNyeXB0aW9uLWtleS1mb3Itc3Rvcnlib29r",
  BYPASS_RATE_LIMIT: "true",
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
};
