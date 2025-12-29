# Code Review Fixes Implementation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all code review issues to make CanonCore production-ready with proper security, validation, and testing.

**Architecture:** Add validation layer (Zod), rate limiting (Upstash Redis), environment validation, and pass real user data through server components. Remove unused code and harden security.

**Tech Stack:** Zod, @upstash/ratelimit, @upstash/redis, Prisma migrations

---

## Decisions Summary

| Area                | Decision                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| User data flow      | Server prop drilling from dashboard layout to sidebar                  |
| Validation          | Zod schemas in `lib/validations.ts`                                    |
| Password complexity | 8+ chars, uppercase, lowercase, number                                 |
| Rate limiting       | Upstash Redis (sign-in: 5/min, sign-up: 3/min, forgot-password: 2/min) |
| E2E compatibility   | `BYPASS_RATE_LIMIT=true` env var skips rate limiting                   |
| Env validation      | Zod schema in `lib/env.ts` at runtime startup                          |
| Session model       | Remove (unused with JWT strategy)                                      |
| Token expiry        | 30 minutes (reduced from 1 hour)                                       |
| Security logging    | Console.warn with IP, event type, timestamp                            |
| GitHub link         | Remove from site header                                                |
| Image optimization  | Enable with CloudFront remote pattern                                  |
| Testing             | Unit tests for validations, integration tests for password reset       |
| DB index            | Add index on `PasswordReset.expires`                                   |
| Dependencies        | Pin versions, add Upstash/Zod/@types/bcryptjs                          |

---

## Files to Create

### `lib/env.ts`

Environment variable validation using Zod. Validates required env vars at runtime startup.

```typescript
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

  // Testing (optional)
  BYPASS_RATE_LIMIT: z.string().optional(),
});

/**
 * Validated environment variables.
 * Throws descriptive error if validation fails.
 */
export const env = envSchema.parse(process.env);
```

### `lib/validations.ts`

Zod validation schemas for authentication actions.

```typescript
/**
 * Zod validation schemas for authentication.
 * Shared between server actions for consistent validation.
 */

import { z } from "zod";

/**
 * Email validation schema.
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Invalid email format");

/**
 * Password validation with complexity requirements.
 * Requires: 8+ chars, uppercase, lowercase, number.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Sign-up form validation schema.
 */
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Reset password validation schema.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: passwordSchema,
});

/**
 * Forgot password validation schema.
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
```

### `lib/rate-limit.ts`

Rate limiting utilities using Upstash Redis.

```typescript
/**
 * Rate limiting utilities using Upstash Redis.
 * Protects auth endpoints from brute force attacks.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Rate limiters for different auth actions.
 * Conservative limits to protect against brute force.
 */
export const rateLimiters = {
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
```

### `tests/unit/lib/validations.test.ts`

Unit tests for validation schemas.

```typescript
import { describe, it, expect } from "vitest";
import { emailSchema, passwordSchema, signUpSchema } from "@/lib/validations";

describe("emailSchema", () => {
  it("accepts valid email", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = emailSchema.safeParse("notanemail");
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = emailSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts valid password with uppercase, lowercase, number", () => {
    expect(passwordSchema.safeParse("Password1").success).toBe(true);
  });

  it("accepts complex password", () => {
    expect(passwordSchema.safeParse("MySecure123Pass").success).toBe(true);
  });

  it("rejects password under 8 characters", () => {
    const result = passwordSchema.safeParse("Pass1");
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = passwordSchema.safeParse("password1");
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    const result = passwordSchema.safeParse("PASSWORD1");
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const result = passwordSchema.safeParse("Password");
    expect(result.success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("accepts valid email and password", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "Password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email with valid password", () => {
    const result = signUpSchema.safeParse({
      email: "invalid",
      password: "Password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects valid email with weak password", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "weak",
    });
    expect(result.success).toBe(false);
  });
});
```

### `tests/integration/auth/password-reset.test.ts`

Integration tests for password reset flow.

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { forgotPassword, resetPassword } from "@/lib/auth-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

describe("password reset integration", () => {
  const testEmail = () => `reset-${Date.now()}@test.example.com`;

  beforeEach(async () => {
    // Clean up any test password reset tokens
    await prisma.passwordReset.deleteMany({
      where: { user: { email: { contains: "@test.example.com" } } },
    });
  });

  it("creates reset token for existing user", async () => {
    // Create a test user first
    const email = testEmail();
    await prisma.user.create({
      data: { email, passwordHash: "hashed" },
    });

    // Request password reset
    const result = await forgotPassword(email);
    expect(result.success).toBe(true);

    // Verify token was created
    const token = await prisma.passwordReset.findFirst({
      where: { user: { email } },
    });
    expect(token).not.toBeNull();
    expect(token?.expires.getTime()).toBeGreaterThan(Date.now());
  });

  it("resets password with valid token", async () => {
    const email = testEmail();
    const user = await prisma.user.create({
      data: { email, passwordHash: "oldhash" },
    });

    // Create a valid token
    const token = await prisma.passwordReset.create({
      data: {
        token: "valid-test-token",
        userId: user.id,
        expires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Reset password
    const result = await resetPassword(token.token, "NewPassword1");
    expect(result.success).toBe(true);

    // Verify password was updated
    const updatedUser = await prisma.user.findUnique({ where: { email } });
    expect(updatedUser?.passwordHash).not.toBe("oldhash");
  });

  it("rejects expired token", async () => {
    const email = testEmail();
    const user = await prisma.user.create({
      data: { email, passwordHash: "hash" },
    });

    // Create an expired token
    await prisma.passwordReset.create({
      data: {
        token: "expired-token",
        userId: user.id,
        expires: new Date(Date.now() - 1000), // Expired
      },
    });

    const result = await resetPassword("expired-token", "NewPassword1");
    expect(result.error).toBe("Reset link has expired");
  });

  it("deletes token after successful reset", async () => {
    const email = testEmail();
    const user = await prisma.user.create({
      data: { email, passwordHash: "hash" },
    });

    const token = await prisma.passwordReset.create({
      data: {
        token: "one-time-token",
        userId: user.id,
        expires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await resetPassword(token.token, "NewPassword1");

    // Token should be deleted
    const deletedToken = await prisma.passwordReset.findUnique({
      where: { token: token.token },
    });
    expect(deletedToken).toBeNull();
  });
});
```

---

## Files to Modify

### `lib/auth-actions.ts`

Add validation, rate limiting, security logging, and update token expiry.

**Changes:**

1. Import validation schemas, rate limiter, and headers
2. Add `logSecurityEvent()` helper function
3. Add rate limiting to all three actions
4. Add Zod validation to all three actions
5. Change token expiry from 60 min to 30 min
6. Add security event logging

### `lib/email.ts`

Use environment variable for sender address.

**Changes:**

1. Import `env` from `@/lib/env`
2. Replace hardcoded `from: "onboarding@resend.dev"` with `from: env.EMAIL_FROM`

### `lib/prisma.ts`

Use validated environment variables.

**Changes:**

1. Import `env` from `@/lib/env`
2. Replace `process.env.DATABASE_URL!` with `env.DATABASE_URL`

### `components/app-sidebar.tsx`

Accept user prop instead of hardcoded data.

**Changes:**

1. Remove hardcoded `user` from `data` object
2. Add `user` prop to `AppSidebarProps` interface
3. Pass `user` prop to `NavUser` component

### `app/(dashboard)/layout.tsx`

Pass session user data to sidebar.

**Changes:**

1. Extract user data from session
2. Pass `user` prop to `AppSidebar`

### `components/site-header.tsx`

Remove GitHub link.

**Changes:**

1. Remove the entire GitHub button/link element

### `next.config.mjs`

Enable image optimization with remote patterns.

**Changes:**

1. Replace `images: { unoptimized: true }` with `remotePatterns` configuration

### `prisma/schema.prisma`

Remove Session model, add index.

**Changes:**

1. Remove `Session` model entirely
2. Remove `sessions` relation from `User` model
3. Add `@@index([expires])` to `PasswordReset` model

### `package.json`

Pin dependency versions, add new dependencies.

**Changes:**

1. Pin all `"latest"` dependencies to specific versions
2. Add `@upstash/ratelimit`, `@upstash/redis`, `zod` to dependencies
3. Add `@types/bcryptjs` to devDependencies

---

## Environment Variables

### New Variables Required

Add to `.env.local`:

```bash
# Email sender address
EMAIL_FROM="noreply@canoncore.com"

# E2E test bypass (only set in test environment)
# BYPASS_RATE_LIMIT="true"
```

### Already Configured

- `UPSTASH_REDIS_REST_URL` - Added to .env.local
- `UPSTASH_REDIS_REST_TOKEN` - Added to .env.local

---

## Database Migration

Run after schema changes:

```bash
npx prisma migrate dev --name remove-session-add-expires-index
```

This will:

1. Drop the `Session` table
2. Add index on `PasswordReset.expires`

---

## Testing Summary

### New Unit Tests (~10 tests)

- `tests/unit/lib/validations.test.ts` - Email, password, schema validation

### New Integration Tests (~4 tests)

- `tests/integration/auth/password-reset.test.ts` - Token creation, reset flow, expiry

### E2E Compatibility

- Set `BYPASS_RATE_LIMIT=true` in E2E environment to skip rate limiting
- No changes to existing E2E tests required

### Expected Test Counts

| Type        | Before | After |
| ----------- | ------ | ----- |
| Unit        | 15     | ~25   |
| Integration | 3      | ~7    |
| E2E         | 34     | 34    |

---

## Implementation Order

1. **Dependencies** - Install new packages, pin versions
2. **Environment** - Create `lib/env.ts`, add EMAIL_FROM to .env.local
3. **Validation** - Create `lib/validations.ts`
4. **Rate Limiting** - Create `lib/rate-limit.ts`
5. **Database** - Update schema, run migration
6. **Auth Actions** - Update `lib/auth-actions.ts` with all changes
7. **Email** - Update `lib/email.ts` to use env var
8. **Prisma** - Update `lib/prisma.ts` to use validated env
9. **User Data Flow** - Update sidebar and dashboard layout
10. **Config** - Update `next.config.mjs` for image optimization
11. **Cleanup** - Remove GitHub link from header
12. **Unit Tests** - Add validation tests
13. **Integration Tests** - Add password reset tests
14. **Verification** - Run all checks and tests

---

## Documentation Standards

All new code follows JSDoc standards from CLAUDE.md:

- File headers with brief description
- Function JSDoc with `@param`, `@returns`
- `@example` for complex utilities
- React props documented inline with TypeScript
