# Deployment 0.3.0: Self-Hosted Auth with NextAuth.js

This release replaces Stack Auth with a self-hosted authentication system using NextAuth.js v5, Prisma, and Neon PostgreSQL. It also adds comprehensive E2E testing with Playwright.

## What changed

### Authentication migrated to NextAuth.js v5

Stack Auth had aggressive rate limiting that caused E2E tests to fail intermittently. The new self-hosted setup gives full control over auth behavior.

**New files:**

- `lib/auth.ts` - NextAuth configuration with Credentials provider
- `lib/auth-actions.ts` - Server actions for sign-up, forgot-password, reset-password
- `lib/email.ts` - Resend integration for password reset emails
- `lib/prisma.ts` - Prisma client singleton with Prisma 7 adapter
- `app/api/auth/[...nextauth]/route.ts` - NextAuth API route

**Removed:**

- `lib/stack.ts` - Stack Auth configuration
- `@stackframe/stack` dependency

### Database schema added with Prisma

Three tables handle authentication:

- `User` - email, passwordHash, profile info
- `Session` - session tokens (used by NextAuth internally)
- `PasswordReset` - time-limited reset tokens

Run migrations with:

```bash
npx prisma migrate dev
```

### E2E testing infrastructure

Playwright tests cover the full auth journey:

- Sign up flow (17 test cases)
- Sign in with valid/invalid credentials
- Password reset request and completion
- Sign out and session handling

Run tests with:

```bash
pnpm run test:e2e
```

## Environment variables

### Required for all environments

| Variable         | Purpose                            |
| ---------------- | ---------------------------------- |
| `DATABASE_URL`   | Neon PostgreSQL connection string  |
| `AUTH_SECRET`    | NextAuth.js session encryption key |
| `RESEND_API_KEY` | Transactional email sending        |

### Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

### Vercel configuration

Production and preview environments need:

```bash
vercel env add AUTH_SECRET production preview
vercel env add RESEND_API_KEY production preview
```

Remove old Stack Auth variables:

```bash
vercel env rm NEXT_PUBLIC_STACK_PROJECT_ID production preview
vercel env rm NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY production preview
vercel env rm STACK_SECRET_SERVER_KEY production preview
```

## Breaking changes

- Auth pages now use `token` query param instead of `code` for password reset
- Session strategy changed from database to JWT
- All Stack Auth hooks (`useStackApp`, `useUser`) replaced with NextAuth equivalents

## Verify the deployment

After deploying:

1. Create a new account at `/sign-up`
2. Sign out and sign back in at `/sign-in`
3. Test password reset flow at `/forgot-password`
4. Confirm dashboard access at `/dashboard`
