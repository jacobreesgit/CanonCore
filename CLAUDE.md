# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm run dev          # Start development server
pnpm run build        # Production build
pnpm run check        # Run all checks (format, lint, type-check, knip, build)

# Code quality
pnpm run format       # Format code with Prettier
pnpm run lint         # Run ESLint
pnpm run type-check   # TypeScript type checking
pnpm run knip         # Check for unused code/dependencies

# Unit & Integration tests (Vitest)
pnpm run test              # Run unit tests
pnpm run test:unit         # Run unit tests (explicit)
pnpm run test:integration  # Run integration tests (real DB)
pnpm run test:coverage     # Unit tests with coverage
pnpm run test:watch        # Watch mode

# E2E tests (Playwright)
pnpm run test:e2e                           # All tests (desktop + mobile)
pnpm run test:e2e --project=chromium        # Desktop only
pnpm run test:e2e --project=mobile-chrome   # Mobile only
pnpm run test:e2e:debug                     # Debug mode
pnpm run test:e2e:ui                        # UI mode
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
│   ├── ui/                           # shadcn/ui components
│   ├── app-sidebar.tsx               # Main navigation sidebar
│   ├── nav-documents.tsx             # Document navigation with actions
│   ├── nav-main.tsx                  # Primary navigation items
│   ├── nav-secondary.tsx             # Utility navigation links
│   ├── nav-user.tsx                  # User dropdown with sign-out
│   ├── section-cards.tsx             # Dashboard metric cards
│   └── site-header.tsx               # Top header bar
├── e2e/
│   ├── fixtures/                     # Playwright test fixtures (auth, db)
│   ├── helpers/                      # Test utilities (test-user.ts)
│   ├── journeys/auth/                # Auth E2E tests (sign-in, sign-up, etc.)
│   ├── pages/                        # Page Object Models
│   └── playwright.config.ts
├── tests/
│   ├── unit/
│   │   ├── lib/                      # Unit tests for lib/ (auth-actions, utils)
│   │   ├── setup.ts                  # Mocks for Prisma and email
│   │   └── vitest.config.ts
│   ├── integration/
│   │   ├── auth/                     # Integration tests (real DB)
│   │   ├── setup.ts                  # DB cleanup, env loading
│   │   └── vitest.config.ts
│   └── vitest.config.ts              # Base Vitest config
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
├── skills/                           # Claude Code skills
│   ├── code-review-excellence/       # Code review best practices
│   ├── docs-write/                   # Documentation writing style
│   └── frontend-design/              # Frontend interface design
└── docs/
    ├── deployments/                  # Deployment summaries (0.2.0 - 0.6.0)
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

### Unit & Integration Testing

- **Vitest** for fast unit and integration tests
- Unit tests in `tests/unit/` - mock Prisma and email
- Integration tests in `tests/integration/` - real database
- Coverage configured for `lib/**`
- 18 total tests (15 unit + 3 integration)

### E2E Testing

- **Playwright** with Page Object Model pattern
- Tests in `e2e/journeys/` organized by feature
- Page objects in `e2e/pages/` for reusable interactions
- Fixtures in `e2e/fixtures/` for auth and database setup
- Runs on desktop Chrome and mobile Chrome (iPhone 14)
- 34 total tests (17 desktop + 17 mobile)

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

## Documentation Standards

All custom code (excluding `components/ui/*` shadcn components) follows these JSDoc conventions:

### File Headers

Every file starts with a brief descriptive comment:

```typescript
/**
 * Brief description of what this file does.
 * Optional second line for additional context.
 */
```

### Function Documentation

Use standard JSDoc with `@param`, `@returns`, and `@example` (for complex functions):

```typescript
/**
 * Brief description of what the function does.
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 *
 * @example
 * const result = myFunction("input");
 */
```

### Guidelines

- **File headers**: Required for all files (lib, hooks, components, app pages)
- **Function JSDoc**: Required for exported functions and React components
- **`@example`**: Include for complex utilities and server actions; skip for simple functions and React components
- **React props**: Document inline with TypeScript types, not JSDoc
- **Skip**: `components/ui/*` (shadcn generated code)
