/**
 * Environment variable validation using Zod.
 * Validates required env vars at runtime startup.
 */

import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

  // Email
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  EMAIL_FROM: z.string().email().default("noreply@canoncore.com"),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Rate limiting
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Encryption (for sensitive data like OAuth tokens)
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),

  // Testing (optional)
  BYPASS_RATE_LIMIT: z.string().optional(),

  // Google Drive (optional - only needed for Drive integration)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

/**
 * Validated environment variables.
 * Throws descriptive error if validation fails.
 */
export const env = envSchema.parse(process.env);
