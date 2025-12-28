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
```

## Architecture

**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, Stack Auth, shadcn/ui

### Route Structure

```
app/
├── (auth)/
│   ├── forgot-password/page.tsx    # Request password reset email
│   ├── reset-password/page.tsx     # Set new password from email link
│   ├── sign-in/page.tsx            # Email/password sign in
│   └── sign-up/page.tsx            # Account creation
├── (dashboard)/
│   ├── dashboard/page.tsx          # Main dashboard view
│   └── layout.tsx                  # Protected layout with sidebar
├── globals.css
├── layout.tsx                      # Root layout with StackProvider
└── page.tsx                        # Public landing page
components/
├── ui/                             # shadcn/ui components
├── app-sidebar.tsx                 # Main navigation sidebar
├── nav-user.tsx                    # User dropdown with sign-out
├── section-cards.tsx               # Dashboard metric cards
└── site-header.tsx                 # Top header bar
lib/
├── stack.ts                        # Stack Auth server config
└── utils.ts                        # cn() helper
hooks/
└── use-mobile.ts                   # Mobile breakpoint hook
```

### Authentication

- **Stack Auth** (`@stackframe/stack`) handles authentication
- Server-side auth: `lib/stack.ts` exports `stackServerApp`
- Client-side hooks: `useStackApp()` for sign-in/sign-up/sign-out
- Protected routes use `await stackServerApp.getUser({ or: "redirect" })` in server components
- Auth URLs configured: `/sign-in`, `/sign-up`, `/reset-password`
- After auth redirect: `/dashboard`

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
- `NEXT_PUBLIC_STACK_PROJECT_ID` - Stack Auth project ID
- `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` - Stack Auth public key
- `STACK_SECRET_SERVER_KEY` - Stack Auth secret key
