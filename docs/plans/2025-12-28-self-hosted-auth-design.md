# Self-Hosted Auth with NextAuth.js v5

## Overview

Replace Stack Auth with NextAuth.js v5 + Prisma + Neon PostgreSQL to eliminate external API rate limits that break E2E tests.

### Goals

- E2E tests can create/sign-in users without external rate limits
- Keep existing custom UI pages (sign-in, sign-up, forgot-password, reset-password)
- Direct database access for test fixtures (seed users, cleanup)
- Password reset emails via Resend

### Out of Scope

- OAuth providers (Google, GitHub) - can add later
- Magic link auth - credentials only for now
- 2FA - future enhancement

### Success Criteria

- All 17 E2E tests pass reliably
- Sign-up/sign-in works in <100ms (no external API latency)
- Tests can seed users directly via Prisma

## Tech Stack

### Dependencies to Add

- `next-auth@5` (beta) - Auth library
- `@auth/prisma-adapter` - Database adapter
- `bcryptjs` + `@types/bcryptjs` - Password hashing
- `resend` - Email delivery

### Dependencies to Remove

- `@stackframe/stack` - Stack Auth SDK

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Custom UI Pages                       │
│  (sign-in, sign-up, forgot-password, reset-password)    │
└─────────────────────┬───────────────────────────────────┘
                      │ API calls
                      ▼
┌─────────────────────────────────────────────────────────┐
│              NextAuth.js v5 (Auth.js)                   │
│  - Credentials provider (email/password)                │
│  - Session management (JWT in cookies)                  │
│  - Prisma adapter for user storage                      │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌───────────────┐           ┌───────────────┐
│ Neon Postgres │           │    Resend     │
│ (User data)   │           │ (Email sends) │
└───────────────┘           └───────────────┘
```

## Database Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id             String    @id @default(cuid())
  email          String    @unique
  emailVerified  DateTime?
  passwordHash   String
  name           String?
  image          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  sessions       Session[]
  passwordResets PasswordReset[]
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PasswordReset {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expires   DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## File Changes

### Files to Create

```
prisma/
└── schema.prisma              # Database schema

lib/
├── auth.ts                    # NextAuth config (replaces stack.ts)
├── auth-actions.ts            # Server actions: signUp, forgotPassword, resetPassword
└── email.ts                   # Resend email helper

app/
└── api/auth/[...nextauth]/
    └── route.ts               # NextAuth API route
```

### Files to Modify

```
app/(auth)/sign-in/page.tsx        # useStackApp() → signIn() from next-auth
app/(auth)/sign-up/page.tsx        # useStackApp() → server action
app/(auth)/forgot-password/page.tsx # useStackApp() → server action
app/(auth)/reset-password/page.tsx  # useStackApp() → server action
app/(dashboard)/layout.tsx          # stackServerApp.getUser() → auth()
components/nav-user.tsx             # useStackApp().signOut() → signOut()
```

### Files to Delete

```
lib/stack.ts                   # Stack Auth config
```

### Environment Variables

**Add:**

```
AUTH_SECRET=<random-string>    # NextAuth secret (generate with: openssl rand -base64 32)
RESEND_API_KEY=<from-resend>   # Email sending
```

**Remove:**

```
NEXT_PUBLIC_STACK_PROJECT_ID
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
STACK_SECRET_SERVER_KEY
```

## E2E Testing Strategy

### Two Approaches

1. **UI sign-up tests** - Test the actual sign-up form → API → database flow
   - Verifies the full journey works
   - Hits local API, not external service → no rate limits
   - Can run in parallel

2. **DB-seeded tests** - For tests that need a user but aren't testing sign-up
   - Sign-in tests: seed user first, then test sign-in UI
   - Sign-out tests: seed user, sign in, test sign-out
   - Faster setup, focused on what the test validates

### Updated Test Fixture

```typescript
// e2e/fixtures/db.fixture.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function seedTestUser(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: { email, passwordHash },
  });
}

export async function cleanupTestUser(email: string) {
  await prisma.user.deleteMany({ where: { email } });
}

export async function cleanupTestUsers() {
  await prisma.user.deleteMany({
    where: { email: { contains: "test-" } },
  });
}
```

### Test Mapping

- `sign-up.spec.ts` → Tests real UI sign-up flow
- `sign-in.spec.ts` → Seeds user via DB, tests UI sign-in
- `sign-out.spec.ts` → Seeds user via DB, tests UI sign-out
- `forgot-password.spec.ts` → Tests UI flow (no DB seed needed)

## Migration Steps

### Phase 1: Database Setup

1. Initialize Prisma: `npx prisma init`
2. Add schema (User, Session, PasswordReset tables)
3. Run migration: `npx prisma migrate dev --name init`

### Phase 2: Auth Backend

1. Install deps: `pnpm add next-auth@beta @auth/prisma-adapter bcryptjs resend`
2. Install types: `pnpm add -D @types/bcryptjs`
3. Create `lib/auth.ts` - NextAuth config with credentials provider
4. Create `lib/auth-actions.ts` - Server actions for sign-up, forgot/reset password
5. Create `lib/email.ts` - Resend helper
6. Add API route `app/api/auth/[...nextauth]/route.ts`

### Phase 3: Update UI Pages

1. `sign-in/page.tsx` - Replace `useStackApp()` with `signIn()` from next-auth
2. `sign-up/page.tsx` - Call server action instead of Stack Auth
3. `forgot-password/page.tsx` - Call server action
4. `reset-password/page.tsx` - Call server action
5. `nav-user.tsx` - Replace sign-out call
6. `(dashboard)/layout.tsx` - Replace `stackServerApp.getUser()` with `auth()`

### Phase 4: Cleanup

1. Remove `@stackframe/stack` dependency
2. Delete `lib/stack.ts`
3. Remove Stack Auth env vars from `.env.local`

### Phase 5: Update E2E Tests

1. Update `db.fixture.ts` with real Prisma seeding
2. Remove `.skip` from tests
3. Verify all 17 tests pass
