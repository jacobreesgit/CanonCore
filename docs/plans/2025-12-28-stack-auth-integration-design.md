# Stack Auth Integration Design

## Overview

Integrate Stack Auth with custom shadcn UI for CanonCore2. Email/password authentication with protected dashboard routes.

## Environment & Database Setup

### Branch Strategy (Git & Neon aligned)

| Git Branch    | Neon Branch   | Domain                             |
| ------------- | ------------- | ---------------------------------- |
| `development` | `development` | `localhost:3000` + Vercel previews |
| `production`  | `production`  | `canoncore.com`                    |

### Setup Steps

1. Rename current Neon database to `production`
2. Create Neon `development` branch from production
3. Rename git `main` → `development`
4. Create git `production` branch

### Environment Files

```
.env.local          → development DB credentials (gitignored)
.env.production     → production DB credentials (set in Vercel)
```

### Prisma

- Install Prisma with Neon adapter
- Stack Auth handles core user/session tables
- Prisma for any extended user data if needed later

## Routes & Page Structure

### Public Routes

| Route              | Purpose                                     |
| ------------------ | ------------------------------------------- |
| `/`                | Landing page (hero8 block + sign in button) |
| `/sign-in`         | Sign in form                                |
| `/sign-up`         | Sign up form                                |
| `/forgot-password` | Forgot password form                        |
| `/reset-password`  | Reset password form (with token)            |

### Protected Routes

| Route        | Purpose                       |
| ------------ | ----------------------------- |
| `/dashboard` | Sidebar layout + SectionCards |

### File Structure

```
app/
├── page.tsx                      → Landing (hero8)
├── layout.tsx                    → Root layout (no sidebar)
├── (auth)/
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (dashboard)/
│   ├── layout.tsx                → Sidebar layout
│   └── dashboard/page.tsx        → SectionCards only
```

### Route Protection

- Middleware checks auth on `/dashboard/*` routes
- Redirects to `/sign-in` if not authenticated
- Redirects to `/dashboard` after successful sign in

## Stack Auth Integration

### Package

```
@stackframe/stack
```

### Provider Setup

Wrap app in `StackProvider` with existing env credentials:

- `NEXT_PUBLIC_STACK_PROJECT_ID`
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`
- `STACK_SECRET_SERVER_KEY`

### Auth Hooks

```typescript
useUser(); // Get current user, loading state
useStackApp(); // Access signIn, signUp, signOut methods
```

### Custom UI Flow

1. shadcn form collects email/password
2. On submit, call `stackApp.signUpWithCredential()` or `stackApp.signInWithCredential()`
3. Stack Auth handles validation, session, errors
4. Display errors in UI

### Middleware Protection

```typescript
// middleware.ts
stackServerApp.getUser(); // Server-side auth check
```

## UI Components

### shadcn Blocks

```bash
npx shadcn add @shadcnblocks/hero8      # Landing page hero
npx shadcn add @shadcnblocks/signup10   # Auth forms base
```

### Auth Screens (from signup10 base)

| Screen          | Fields                                   |
| --------------- | ---------------------------------------- |
| Sign in         | email, password, "Forgot password?" link |
| Sign up         | email, password, confirm password        |
| Forgot password | email only                               |
| Reset password  | new password, confirm password           |

### Sign Out

- Button in sidebar user nav
- Calls `stackApp.signOut()` → redirects to `/`

## Implementation Order

1. Environment setup (Neon branches, git branches, env files)
2. Install dependencies (`@stackframe/stack`, Prisma)
3. Stack Auth provider setup
4. Install shadcn blocks (hero8, signup10)
5. Create landing page (`/`)
6. Move current layout to dashboard route group
7. Create auth pages (sign-in, sign-up, forgot-password, reset-password)
8. Add middleware for route protection
9. Connect auth forms to Stack Auth SDK
10. Add sign out to sidebar
