# Deployment 0.7.0 - Production-Ready Security

**Date:** 2025-12-29
**Branch:** development

## Summary

This release adds production-ready security features: server-side validation, rate limiting, environment validation, and real user data flow. Removes unused code and hardens authentication flows.

## Changes

### Security

- **Rate limiting** on auth endpoints (Upstash Redis)
  - Sign-in: 5 attempts/minute
  - Sign-up: 3 attempts/minute
  - Forgot password: 2 attempts/minute
  - E2E bypass: Set `BYPASS_RATE_LIMIT=true` in test environment
- **Security logging** for all auth events (IP, timestamp, action type)
- **Password reset token expiry** reduced from 60 to 30 minutes
- **Orphaned token cleanup** when email sending fails

### Validation

- **Zod schemas** for all auth inputs (`lib/validations.ts`)
  - Email: Required, valid format
  - Password: 8+ chars, uppercase, lowercase, number
- **Environment validation** at startup (`lib/env.ts`)
  - Catches missing env vars immediately, not at runtime

### User Data Flow

- **Real session data** flows from server to sidebar
- Removed hardcoded "shadcn" / "m@example.com" placeholder data
- User name, email, avatar passed via server component props

### Cleanup

- **Removed Session model** from Prisma (unused with JWT strategy)
- **Added database index** on `PasswordReset.expires` for query performance
- **Removed GitHub link** from site header
- **Enabled image optimization** with CloudFront remote patterns

### Testing

- **12 new unit tests** for validation schemas
- **5 new integration tests** for password reset flow
- Updated existing tests with proper env mocking
- Total: 31 unit tests, 8 integration tests

## New Files

| File                                            | Purpose                          |
| ----------------------------------------------- | -------------------------------- |
| `lib/env.ts`                                    | Environment variable validation  |
| `lib/validations.ts`                            | Zod validation schemas           |
| `lib/rate-limit.ts`                             | Upstash rate limiting            |
| `tests/unit/lib/validations.test.ts`            | Validation unit tests            |
| `tests/integration/auth/password-reset.test.ts` | Password reset integration tests |

## Modified Files

| File                         | Changes                                    |
| ---------------------------- | ------------------------------------------ |
| `lib/auth-actions.ts`        | Added validation, rate limiting, logging   |
| `lib/email.ts`               | Uses validated env, updated expiry message |
| `lib/prisma.ts`              | Uses validated env                         |
| `components/app-sidebar.tsx` | Accepts user prop                          |
| `components/nav-user.tsx`    | Made avatar optional                       |
| `app/(dashboard)/layout.tsx` | Passes session user to sidebar             |
| `components/site-header.tsx` | Removed GitHub link                        |
| `next.config.mjs`            | Added image remote patterns                |
| `prisma/schema.prisma`       | Removed Session, added expires index       |
| `package.json`               | Added Upstash, Zod; pinned versions        |

## Database Migration

Run after deploying:

```bash
npx prisma migrate deploy
```

Migration `remove_session_add_expires_index`:

- Drops `Session` table
- Adds index on `PasswordReset.expires`

## New Environment Variables

Add to production environment:

```bash
EMAIL_FROM="noreply@yourapp.com"  # Sender email address
```

Already configured (from previous deploys):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Verification

All checks pass:

- Format, lint, type-check, knip, build
- 31 unit tests
- 8 integration tests
- 34 E2E tests (separate run)
