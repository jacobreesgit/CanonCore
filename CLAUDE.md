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
│   │   ├── dashboard/
│   │   │   ├── connections/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── [itemId]/page.tsx  # SFTP folder detail
│   │   │   │   │   ├── edit/page.tsx      # Edit connection form
│   │   │   │   │   └── page.tsx           # Connection file browser
│   │   │   │   ├── new/page.tsx           # New connection form
│   │   │   │   └── page.tsx               # Connections list
│   │   │   ├── [itemId]/page.tsx     # Folder detail with children
│   │   │   └── page.tsx              # Root items view
│   │   └── layout.tsx                # Protected layout with sidebar
│   ├── (docs)/
│   │   ├── docs/
│   │   │   └── [[...slug]]/page.tsx  # Dynamic documentation pages
│   │   └── layout.tsx                # Docs layout with sidebar navigation
│   ├── (public)/
│   │   ├── layout.tsx                # Public layout with guest sidebar
│   │   └── page.tsx                  # Public landing page
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # NextAuth API route
│   │   └── sftp/download/[itemId]/route.ts  # SFTP file download stream
│   ├── globals.css
│   └── layout.tsx                    # Root layout with providers
├── components/
│   ├── items/                        # Items feature components
│   │   ├── add-item-button.tsx       # Inline expandable add input
│   │   ├── item-context-menu.tsx     # Right-click actions menu
│   │   ├── items-view.tsx            # Main view with tree/grid toggle (SFTP-aware)
│   │   └── view-toggle.tsx           # Tree/grid view switcher
│   ├── sftp/                         # SFTP connection components
│   │   ├── connection-card.tsx       # Connection card with actions
│   │   ├── connection-form.tsx       # Create/edit connection form
│   │   ├── connection-test-button.tsx  # Test with latency display
│   │   ├── download-button.tsx       # File download with progress
│   │   ├── file-upload-dialog.tsx    # Upload files to SFTP
│   │   ├── sync-button.tsx           # Trigger sync with progress
│   │   └── sync-status-badge.tsx     # Visual sync status indicator
│   ├── sortable-grid/                # Grid view with drag-drop
│   │   ├── GridItem.tsx              # Card display component
│   │   ├── SortableGrid.tsx          # dnd-kit grid container
│   │   └── SortableGridItem.tsx      # Draggable grid item wrapper
│   ├── sortable-tree/                # Tree view with drag-drop
│   │   ├── components/TreeItem/      # Tree node components
│   │   ├── SortableTree.tsx          # dnd-kit tree container
│   │   ├── keyboardCoordinates.ts    # Keyboard navigation
│   │   └── utilities.ts              # Tree manipulation helpers
│   ├── providers/
│   │   └── theme-provider.tsx        # next-themes provider wrapper
│   ├── ui/                           # shadcn/ui components
│   ├── app-sidebar.tsx               # Context-aware navigation sidebar
│   ├── nav-docs.tsx                  # Docs tree navigation (Fumadocs)
│   ├── nav-guest.tsx                 # Guest navigation with auth buttons
│   ├── nav-main.tsx                  # Dashboard main nav items
│   ├── nav-secondary.tsx             # Dashboard secondary nav items
│   ├── nav-user.tsx                  # User dropdown menu
│   ├── site-header.tsx               # Top header bar with breadcrumbs
│   └── theme-toggle.tsx              # Dark/light mode toggle
├── e2e/
│   ├── docker-compose.yml            # SFTP test containers (parallel workers)
│   ├── fixtures/                     # Playwright fixtures (auth, db, sftp)
│   ├── helpers/                      # Test utilities (test-user.ts)
│   ├── journeys/
│   │   ├── auth/                     # Auth E2E tests
│   │   ├── connections/              # SFTP connection CRUD tests
│   │   ├── docs/                     # Documentation E2E tests
│   │   ├── items/                    # Items E2E tests (CRUD, drag, views)
│   │   ├── sftp/                     # SFTP sync and file operation tests
│   │   ├── theme/                    # Dark mode E2E tests
│   │   ├── global.setup.ts           # Docker container startup
│   │   └── global.teardown.ts        # Docker container cleanup
│   ├── pages/                        # Page Object Models
│   └── playwright.config.ts
├── tests/
│   ├── unit/
│   │   ├── lib/                      # Unit tests (auth, items, sftp, crypto)
│   │   ├── e2e/                      # E2E fixture unit tests
│   │   ├── setup.ts                  # Mocks for Prisma and email
│   │   └── vitest.config.ts
│   ├── integration/
│   │   ├── auth/                     # Auth integration tests
│   │   ├── items/                    # Items integration tests (CRUD, hierarchy)
│   │   ├── sftp/                     # SFTP connection integration tests
│   │   ├── setup.ts                  # DB cleanup, env loading
│   │   └── vitest.config.ts
│   └── vitest.config.ts              # Base Vitest config
├── hooks/
│   └── use-mobile.ts                 # Mobile breakpoint hook
├── content/
│   └── docs/                         # MDX documentation pages (19 files)
├── lib/
│   ├── auth.ts                       # NextAuth config, extractSidebarUser helper
│   ├── auth-actions.ts               # Auth server actions
│   ├── crypto.ts                     # AES-256-GCM credential encryption
│   ├── item-actions.ts               # Item CRUD server actions
│   ├── item-utils.ts                 # Tree/flat conversion utilities
│   ├── types.ts                      # Shared TypeScript types (Item, SFTP types)
│   ├── email.ts                      # Resend email helper
│   ├── env.ts                        # Zod environment variable validation
│   ├── prisma.ts                     # Prisma client singleton
│   ├── rate-limit.ts                 # Upstash Redis rate limiting
│   ├── sftp-actions.ts               # SFTP connection and sync server actions
│   ├── sftp-client.ts                # SFTP client wrapper with pooling
│   ├── sftp-utils.ts                 # Path sanitization, timeout helpers
│   ├── source.ts                     # Fumadocs source configuration
│   ├── utils.ts                      # cn() helper
│   └── validations.ts                # Zod schemas (auth, items, SFTP)
├── prisma/
│   ├── migrations/                   # Database migrations
│   └── schema.prisma                 # User, PasswordReset, Item, SftpConnection
├── skills/                           # Claude Code skills
│   ├── code-review-excellence/       # Code review best practices
│   ├── docs-write/                   # Documentation writing style
│   └── frontend-design/              # Frontend interface design
└── docs/
    ├── deployments/                  # Deployment summaries (0.2.0 - 0.12.0)
    └── plans/                        # Design documents
```

### Authentication

- **NextAuth.js v5** with Credentials provider for email/password auth
- Server-side auth: `lib/auth.ts` exports `auth()` function
- Client-side: `signIn()` and `signOut()` from `next-auth/react`
- Server actions: `signUp()`, `forgotPassword()`, `resetPassword()` in `lib/auth-actions.ts`
- Protected routes use `await auth()` + redirect in server components
- Password hashing with bcryptjs
- Password reset emails via Resend (30 min expiry)
- **Rate limiting**: Upstash Redis (sign-in: 5/min, sign-up: 3/min, forgot: 2/min)
- **Validation**: Zod schemas for email/password (8+ chars, uppercase, lowercase, number)
- **Security logging**: All auth events logged with IP and timestamp

### Database

- **Prisma 7** with PostgreSQL (Neon)
- Schema: User, PasswordReset, Item, SftpConnection models
- Item has self-referential parent/child relationships for hierarchy
- Item extended with SFTP fields: `type`, `sftpPath`, `mimeType`, `size`, `syncStatus`, `connectionId`
- SftpConnection stores encrypted credentials with AES-256-GCM
- Enums: `ItemType` (FOLDER, FILE), `SyncStatus`, `AuthType` (PASSWORD, PRIVATE_KEY)
- Config in `prisma.config.ts` (loads DATABASE_URL from .env.local)
- Run migrations: `npx prisma migrate dev`

### Items System

- **Hierarchical folders** with drag-and-drop reordering via dnd-kit
- **Dual view modes**: Tree (hierarchical) and Grid (flat cards)
- **Server actions**: `createItem`, `updateItem`, `deleteItem`, `reorderItems` in `lib/item-actions.ts`
- **Breadcrumb navigation** for folder drill-down
- **Context menu**: Right-click for Rename, Delete, Add Subfolder
- **Toast notifications**: Success/error feedback via Sonner
- **Max depth**: 10 levels of nesting

### SFTP Connections

- **Connection management**: Create, edit, delete SFTP server connections at `/dashboard/connections`
- **Auth methods**: Password or SSH private key authentication
- **Encrypted credentials**: AES-256-GCM encryption with `ENCRYPTION_KEY` env var
- **Connection testing**: Test button with latency display
- **Bidirectional sync**: Sync files between SFTP server and web interface
- **Sync status**: Visual badges showing SYNCED, PENDING_UPLOAD, PENDING_DOWNLOAD, CONFLICT, ERROR
- **File operations**: Download, upload, create folders, rename, delete on SFTP server
- **Server actions**: `lib/sftp-actions.ts` for all SFTP operations
- **Path security**: Directory traversal prevention via `lib/sftp-utils.ts`

### User Documentation

- **Fumadocs** for MDX-based documentation at `/docs`
- **19 pages** covering getting started, account, files/folders, connections, views, and preferences
- **Unified layout** with context-aware sidebar navigation using app sidebar shell
- **NavDocs component** renders Fumadocs page tree with collapsible folders
- Content in `content/docs/` with `meta.json` for structure
- Source config in `source.config.ts` and `lib/source.ts`

### Dark Mode

- **next-themes** for theme management with system preference detection
- **ThemeProvider** wraps app in `app/layout.tsx`
- **ThemeToggle** button in header with sun/moon icons
- Preference persists to localStorage

### Unit & Integration Testing

- **Vitest** for fast unit and integration tests
- Unit tests in `tests/unit/` - mock Prisma and email
- Integration tests in `tests/integration/` - real database
- Coverage configured for `lib/**`
- 78 total tests (58 unit + 20 integration)

### E2E Testing

- **Playwright** with Page Object Model pattern
- Tests in `e2e/journeys/` organized by feature (auth, connections, docs, items, sftp, theme)
- Page objects in `e2e/pages/` for reusable interactions
- Fixtures in `e2e/fixtures/` for auth, database, and SFTP setup
- **Docker SFTP containers**: Parallel containers (up to 8 workers) via `e2e/docker-compose.yml`
- Global setup/teardown for Docker container lifecycle
- Runs on desktop Chrome and mobile Chrome (iPhone 14)

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
- `EMAIL_FROM` - Sender email address (default: `noreply@canoncore.com`)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL for rate limiting
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token
- `ENCRYPTION_KEY` - Base64 32-byte key for SFTP credential encryption (generate with: `openssl rand -base64 32`)

Optional:

- `BYPASS_RATE_LIMIT` - Set to `"true"` to skip rate limiting (for E2E tests)
- `NEXT_PUBLIC_APP_URL` - Base URL for email links (default: `http://localhost:3000`)

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
