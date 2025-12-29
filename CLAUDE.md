# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm run dev          # Start development server
pnpm run build        # Production build
pnpm run check        # Run all checks (format, lint, type-check, knip, build)
pnpm run format       # Format code with Prettier
pnpm run lint         # Run ESLint
pnpm run type-check   # TypeScript type checking
pnpm run knip         # Check for unused code/dependencies
pnpm run test:e2e     # Run Playwright E2E tests
```

## Architecture

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, NextAuth.js v5, Prisma, shadcn/ui

### Project Structure

```
.
├── app/
│   ├── (auth)/
│   │   ├── forgot-password/page.tsx  # Request password reset email
│   │   ├── reset-password/page.tsx   # Set new password from email link
│   │   ├── sign-in/page.tsx          # Email/password sign in
│   │   └── sign-up/page.tsx          # Account creation
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx        # Main dashboard view
│   │   └── layout.tsx                # Protected layout with sidebar
│   ├── api/auth/[...nextauth]/route.ts  # NextAuth API route
│   ├── globals.css
│   ├── layout.tsx                    # Root layout with SessionProvider
│   └── page.tsx                      # Public landing page
├── components/
│   ├── ui/                           # shadcn/ui components (avatar, button, card, etc.)
│   ├── app-sidebar.tsx               # Main navigation sidebar
│   ├── nav-user.tsx                  # User dropdown with sign-out
│   ├── section-cards.tsx             # Dashboard metric cards
│   └── site-header.tsx               # Top header bar
├── e2e/
│   ├── fixtures/                     # Playwright test fixtures (auth, db)
│   ├── helpers/                      # Test utilities (test-user.ts)
│   ├── journeys/auth/                # Auth E2E tests (sign-in, sign-up, etc.)
│   ├── pages/                        # Page Object Models
│   └── playwright.config.ts
├── hooks/
│   └── use-mobile.ts                 # Mobile breakpoint hook
├── lib/
│   ├── auth.ts                       # NextAuth config with credentials provider
│   ├── auth-actions.ts               # Server actions: signUp, forgotPassword, resetPassword
│   ├── email.ts                      # Resend email helper
│   ├── prisma.ts                     # Prisma client singleton
│   └── utils.ts                      # cn() helper
├── prisma/
│   ├── migrations/                   # Database migrations
│   └── schema.prisma                 # User, Session, PasswordReset models
├── prisma.config.ts                  # Prisma 7 config (loads .env.local)
└── docs/
    ├── deployments/                  # Deployment summaries
    └── plans/                        # Design documents
```

### Authentication

- **NextAuth.js v5** with Credentials provider for email/password auth
- Server-side auth: `lib/auth.ts` exports `auth()` function
- Client-side: `signIn()` and `signOut()` from `next-auth/react`
- Server actions: `signUp()`, `forgotPassword()`, `resetPassword()` in `lib/auth-actions.ts`
- Protected routes use `await auth()` + redirect in server components
- Password hashing with bcryptjs
- Password reset emails via Resend

### Database

- **Prisma 7** with PostgreSQL (Neon)
- Schema: User, Session, PasswordReset models
- Config in `prisma.config.ts` (loads DATABASE_URL from .env.local)
- Run migrations: `npx prisma migrate dev`

### E2E Testing

- **Playwright** with Page Object Model pattern
- Tests in `e2e/journeys/` organized by feature
- Page objects in `e2e/pages/` for reusable interactions
- Fixtures in `e2e/fixtures/` for auth and database setup
- Run: `pnpm run test:e2e`
- Debug: `pnpm run test:e2e:debug`
- UI mode: `pnpm run test:e2e:ui`

### Styling

- Tailwind CSS 4 with CSS variables
- shadcn/ui "new-york" style
- Prettier with tailwindcss plugin for class sorting
- Auth pages use rounded-full inputs/buttons (signup10 design pattern)

## Branching Strategy

| Git Branch    | Neon Branch   | Vercel Environment |
| ------------- | ------------- | ------------------ |
| `development` | `development` | Preview            |
| `production`  | `production`  | Production         |

- Local development uses `.env.local` pointing to Neon `development` branch
- Vercel production uses environment variables pointing to Neon `production` branch

## Environment Variables

Required in `.env.local` (development):

- `DATABASE_URL` - Neon PostgreSQL connection string (development branch)
- `AUTH_SECRET` - NextAuth secret (generate with: `openssl rand -base64 32`)
- `RESEND_API_KEY` - Resend API key for password reset emails
