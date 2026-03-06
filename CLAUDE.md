# CLAUDE.md — CanonCore Developer Reference

> This file is for AI assistants working on the codebase. For portfolio/product docs, see [README.md](./README.md) and [DESIGN.md](./DESIGN.md).

**Version**: 12.2.0 | **Stack**: Next.js 16, React 19, Prisma 7, NextAuth.js v5, Neon PostgreSQL, Tailwind CSS 4

---

## Quick Commands

```bash
pnpm run dev              # Start dev server (port 3000)
pnpm run build            # Production build
pnpm run type-check       # TypeScript (tsc --noEmit)
pnpm run lint             # ESLint
pnpm run format           # Prettier
pnpm run knip             # Unused code detection
pnpm run test             # Unit tests (vitest, uses tests/unit/vitest.config.ts)
pnpm run test:integration # Integration tests (real Neon DB, uses tests/integration/vitest.config.ts)
pnpm run test:e2e         # Playwright E2E (desktop + mobile Chrome)
pnpm run mockups          # Screenshot → mockup → webp pipeline (headed)
```

**Important**: Running `pnpm vitest run` directly (without `--config`) picks up E2E files — always use `pnpm run test` or `pnpm run test:integration`.

---

## Project Structure

### Route Groups

```
app/
├── (auth)/                    # Sign-in, sign-up, forgot/reset password
│   └── layout.tsx             # Redirect guard (authenticated → home)
├── (public)/                  # Landing, explore, profiles, docs, legal
│   ├── docs/[[...slug]]/      # Fumadocs user documentation
│   ├── legal/[[...slug]]/     # Legal pages (privacy, terms, cookies)
│   ├── explore/               # Public content browser (Collections/Playlists tabs)
│   ├── u/[username]/          # Public profile pages
│   │   ├── [itemId]/          # Item detail (hero, metadata, files)
│   │   └── playlists/[playlistId]/ # Playlist detail
│   └── layout.tsx             # Shared layout with ContentLayout
├── api/
│   ├── auth/[...nextauth]/    # NextAuth routes
│   ├── stream/[fileId]/       # Media streaming (HTTP Range)
│   ├── artwork/[fileId]/      # Image streaming from Drive
│   ├── user/avatar/ & hero/   # Profile image endpoints
│   ├── playlist/artwork/      # Playlist artwork upload
│   ├── health/                # DB connectivity check
│   └── fork/[itemId]/         # Fork action
├── verify-email/              # Email verification landing page
├── layout.tsx                 # Root layout (dark theme, Font Awesome CSS)
└── globals.css                # Design tokens, animations, utility classes
```

### Server Actions (`lib/*-actions.ts`)

All mutations go through server actions. Convention: parallel rate limit + auth check.

```typescript
const [rateLimitResult, session] = await Promise.all([
  checkRateLimit("action-name"),
  auth(),
]);
```

| File | Scope |
|------|-------|
| `auth-actions.ts` | Sign up, forgot/reset password, email verification, lockout check |
| `user-actions.ts` | Profile updates, username, avatar/hero uploads, account deletion, data export |
| `item-actions.ts` | Item CRUD, reordering, pinning, progress |
| `item-file-actions.ts` | File uploads, replacements, deletion |
| `playlist-actions.ts` | Playlist CRUD, artwork, share tokens, item membership, reordering |
| `watch-actions.ts` | Watch records (create, mark, unmark, batch, status query) |
| `shelf-actions.ts` | Home shelf CRUD and data fetching |
| `fork-actions.ts` | Fork collections |
| `google-drive-actions.ts` | OAuth, sync, connection management |
| `tmdb-actions.ts` | Metadata search, image fetching, per-field clearing, display options |

### Key Library Files

| File | Purpose |
|------|---------|
| `auth.ts` | NextAuth config (credentials, JWT callbacks, lockout, token version) |
| `prisma.ts` | Extended Prisma client singleton with audit logging |
| `env.ts` | Zod-based runtime env validation |
| `validations.ts` | Zod schemas for all form inputs |
| `rate-limit.ts` | Upstash Redis rate limiters per action |
| `lockout-utils.ts` | Account lockout pure functions |
| `email.ts` | Resend transactional emails (password reset, verification) |
| `messages.ts` | Centralised user-facing message constants |
| `crypto.ts` | AES-256-GCM encryption for OAuth tokens |
| `colour-extract.ts` | Sharp-based dominant colour extraction (server-only) |
| `colour-utils.ts` | Client-safe colour math |
| `types.ts` | Shared TypeScript types |
| `public-auth.ts` | Public item/playlist access checks |
| `source.ts` | Fumadocs loader (docs + legal MDX collections) |
| `circuit-breaker.ts` | Circuit breaker for external APIs |
| `bot-patterns.ts` | AI scraper detection patterns |

### Component Organisation

```
components/
├── ui/              # shadcn/ui + Radix primitives (40+ files)
├── items/           # Item tree/grid, add dialogs, TMDB wizards
├── sortable-tree/   # dnd-kit tree with drag-drop
├── sortable-grid/   # dnd-kit grid layout
├── playlists/       # Playlist creation, cards, reordering
├── hero/            # Cinematic hero (carousel, avatar, types)
├── homepage/        # Landing page (mesh gradient, feature accordion, shelves)
├── profile/         # Settings dialog, profile page
├── search/          # Spotlight search (cmdk)
├── mobile/          # Bottom nav, sheets, mobile-specific components
├── google-drive/    # Drive connection, sync UI
├── media/           # Vidstack player wrapper
├── skeletons/       # Loading placeholders (layout-matched)
├── providers/       # Context providers (auth, theme)
├── site-header.tsx  # Top nav bar (breadcrumbs, verification banner)
├── app-sidebar.tsx  # Left sidebar
└── nav-*.tsx        # Navigation items
```

---

## Database

### Key Models

| Model | Purpose |
|-------|---------|
| `User` | Auth, profile, images, bio, lockout fields, tokenVersion |
| `Item` | Hierarchical tree (self-referential parentId), TMDB metadata, visibility |
| `ItemFile` | Files attached to items (MEDIA/ARTWORK/SUBTITLE), Drive IDs |
| `GoogleDriveConnection` | OAuth tokens (AES-256-GCM encrypted), sync state |
| `Playlist` | Collections (system + user), artwork, shareToken, shelfOrder |
| `PlaylistItem` | Many-to-many join (Playlist ↔ Item) with ordering |
| `WatchRecord` | Watch events (AUTO scrobble / MANUAL mark) |
| `Fork` | Tracks forked items (unique: sourceItemId + userId) |
| `PasswordReset` | Password reset tokens (30-min expiry) |
| `EmailVerificationToken` | Email verification tokens (30-min expiry) |
| `SyncLog` | Google Drive sync operation history |
| `AuditLog` | All mutations logged via Prisma extension |

### Schema Conventions

- **Hierarchy**: `Item.parentId` self-reference, max 10 levels, `depth` tracked
- **Visibility**: `isPublic` + `inheritVisibility` — children can inherit parent visibility
- **Soft state**: `syncStatus` enum (SYNCED/PENDING/SYNCING/ERROR)
- **Ordering**: `order` Int fields with gap-based reordering
- **Blobs**: `image`/`heroImage`/`artworkImage` stored as `Bytes` with companion `*Mime` fields
- **Dominant colour**: Hex string extracted from backdrop for CSS variable pipeline
- **System playlists**: `systemType` enum on Playlist (CONTINUE_WATCHING/WATCHLIST/RECENTLY_ADDED/WATCH_AGAIN)

### Auth Security Fields on User

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `bio` | `VARCHAR(300)` | `NULL` | Public profile bio |
| `tokenVersion` | `Int` | `0` | Incremented on password reset/change to invalidate JWTs |
| `failedLoginAttempts` | `Int` | `0` | Consecutive failed sign-in count |
| `lockedUntil` | `DateTime?` | `NULL` | Account lockout expiry |

### Migrations

Run with `pnpm prisma migrate deploy`. Migrations are in `prisma/migrations/`. CI auto-deploys to development, production, demo, and seed Neon branches.

---

## Authentication & Security

### Auth Flow

- **Provider**: Credentials (email/password, bcryptjs 12 rounds)
- **Sessions**: JWT-based (HTTP-only cookie), not database sessions
- **Token version**: `tokenVersion` stored in JWT, checked against DB on each request. Mismatch → force sign-out
- **Account lockout**: 5 failed attempts → 15-minute lockout. Pure functions in `lockout-utils.ts`
- **Email verification**: On signup and email change. Token-based via `EmailVerificationToken` model. Email changes require verification of new address before update
- **Anti-enumeration**: `checkSignInStatus()` returns `{ status: "ok" }` for unknown emails

### Rate Limiters (Upstash Redis)

| Action | Limit |
|--------|-------|
| Sign-in | 5/min |
| Sign-up | 3/min |
| Forgot/reset password | 2/min |
| Email verification | 3/min |
| Password change | 5/hour |
| Item/playlist/watch/shelf mutations | 30/min |
| Account deletion | 3/hour |
| Data export | 5/hour |
| API routes (artwork/stream) | 60/min |
| Bot crawlers | 120/min |

### Security Features

- AES-256-GCM OAuth token encryption (random IV per encryption)
- HMAC-SHA256 signed upload tokens with timing-safe comparison
- OWASP headers (HSTS, CSP, X-Frame-Options: DENY)
- Multi-layer bot protection (robots.txt, edge blocking, rate limiting)
- All auth events logged with IP and timestamp (Pino structured logging)
- 90-day audit log retention (production), 7-day (development)

---

## Testing

### Structure

```
tests/
├── unit/
│   ├── vitest.config.ts     # jsdom environment, merges root config
│   ├── setup.ts             # Mocks: Prisma, auth, Resend, logger, rate-limit
│   ├── lib/                 # Server action tests
│   ├── hooks/               # Hook tests
│   └── components/          # Component tests (React Testing Library)
├── integration/
│   ├── vitest.config.ts     # node environment, no parallelism, 15s timeout
│   ├── setup.ts             # .env.local loading, test data cleanup
│   └── auth/                # Real DB tests (lockout, verification, token version)
e2e/
├── playwright.config.ts     # Desktop + Mobile Chrome, port 3001
├── journeys/                # Test specs by feature
│   ├── auth/                # Sign-in, sign-up, lockout
│   ├── items/               # CRUD, drag-drop
│   ├── playlists/           # CRUD, visibility
│   ├── sync/                # Google Drive
│   └── profile/             # Bio, settings
├── mockups/                 # Unified screenshot → mockup → webp pipeline
│   ├── playwright.config.ts # 3 projects: laptop, mobile, mockups (headed)
│   ├── screenshots.spec.ts  # App screenshots (11 captures across 10 scenarios × 2 viewports)
│   ├── screenshot.utils.ts  # Capture helpers + inline webp for media-stack
│   ├── mockups.spec.ts      # LS Graphics mockup generation (single + multi-screen)
│   ├── ls-graphics.utils.ts # LS Graphics helpers, multi-screen upload, inline webp
│   └── mockup-config.ts     # Scene mappings, multi-screen config, output paths
├── output/screenshots/      # Intermediate PNGs (.gitignored)
└── pages/                   # Page Object Models
```

### Key Testing Patterns

- **Unit**: Mock Prisma client, auth session, rate limits, Resend. Setup in `tests/unit/setup.ts`
- **Integration**: Real Neon PostgreSQL. Sequential execution (`fileParallelism: false`). Clean test data in setup
- **E2E**: Per-test user creation via authenticated fixtures. Page Object Models in `e2e/pages/`
- **Storybook**: 66 stories with axe-core accessibility checks. Violations fail the build

### next-auth ESM Resolution

`next-auth` is ESM (`"type": "module"`) and imports `next/server` without `.js`. Requires `test.server.deps.inline: ["next-auth"]` in root vitest config.

---

## Conventions & Patterns

### Code Style

- **Unused destructured params**: Prefix with `_` (e.g., `currentUserId: _currentUserId`)
- **Icons**: Font Awesome 7 (`@fortawesome/react-fontawesome`). No lucide-react. FOUC prevention: `config.autoAddCss = false` in root layout with manual CSS import
- **Dark mode only**: `forcedTheme="dark"`, `className="dark"` on html. Single unified `:root` tokens. No `.dark {}` override
- **British English**: In Fumadocs user documentation (`content/docs/`)
- **Serial commas**: Yes (docs style guide)

### Component Patterns

- **`next/dynamic()`** requires default exports — components with only named exports cause type errors
- **Server Components** for data fetching (default). Client Components (`"use client"`) for interactivity
- **Dialog reset**: Use React "adjust state during render" pattern (`if (open && !prevOpen)`) for synchronous reset
- **Mobile**: Bottom sheets replace desktop dialogs. Bottom navigation bar for main sections
- **CSS `has-[[data-state=open]]`**: Grid cards stay elevated while context menu is open

### Design System

- **Colour pipeline**: 10 `@property`-registered CSS variables (`--dark-100` to `--dark-1000`) for animated colour transitions
- **Colour extraction**: `lib/colour-extract.ts` (server, sharp) + `lib/colour-utils.ts` (client, pure math)
- **Section spacing**: CSS variables `--section-px-mobile` through `--section-px-2xl`
- **Gradients**: `--gradient-hero-overlay` (3-layer `color-mix()` with `--dark-900`), `--gradient-card`
- **Animations**: `ken-burns`, `fade-in`, `fade-in-up`, `slide-up`, `shimmer` — all respect `prefers-reduced-motion`
- **Glass morphism**: `--glass-bg`, `--glass-border`, `--glass-hover` tokens

### URL State (nuqs)

Sort, filter, view mode, and tab selections persist to URL query parameters. Pattern: `?sort=name-asc&filter=has-files&view=grid&tab=contents`. localStorage backup for direct navigation.

### Validation

All inputs validated with Zod schemas in `lib/validations.ts`. Key schemas: `signUpSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `verifyEmailSchema`, `bioSchema`, `usernameSchema`, `createItemSchema`, `createPlaylistItemsSchema`, `deleteAccountSchema`.

---

## Infrastructure

### Environment Variables

Required: `DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ENCRYPTION_KEY`, `EMAIL_FROM`

Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TMDB_API_KEY`, `NEXT_PUBLIC_APP_URL`, `BYPASS_RATE_LIMIT`

Runtime validation via Zod in `lib/env.ts` — missing required vars throw descriptive errors at startup.

### CI/CD (GitHub Actions)

1. **Quality gate**: format, lint, type-check, knip
2. **Migrations**: `prisma migrate deploy` to dev/prod/demo/seed Neon branches (scoped by Git branch)
3. **Tests**: Unit + integration (after quality + migrations)
4. **Build**: Next.js production build (after quality + migrations)
5. **Seed**: Separate workflow (manual dispatch or auto after migrations)
6. **Storybook**: Build + component tests with axe-core on every push/PR

### Neon PostgreSQL

Four database branches: development, production, demo, seed. CI scopes migrations by Git branch to prevent advisory lock contention.

### Monitoring

- **Sentry**: Error tracking across client, server, edge with source maps
- **OpenTelemetry**: Distributed tracing via `@vercel/otel`
- **Vercel Speed Insights**: Core Web Vitals
- **Health check**: `/api/health` verifies DB connectivity

---

## Known Quirks

- **knip false positives**: `playlist-button.tsx` (unused file), `embla-carousel-autoplay` (unused dep) — pre-existing
- **knip duplicate exports**: Components with both named + default exports (needed for `next/dynamic()`)
- **E2E port**: Playwright uses port 3001 with `NEXT_DIST_DIR=.next-e2e` to avoid lock conflicts with dev server
- **Mockup pipeline**: `pnpm run mockups` must run headed (`headless: false`) — LS Graphics uses canvas/WebGL that fails silently in headless Chrome. Requires `LS_GRAPHICS_EMAIL` and `LS_GRAPHICS_PASSWORD` in `.env.local`. Screenshots output to gitignored `e2e/output/screenshots/`, final webps to `public/images/` and `public/portfolio/`. Supports multi-screen scenes (e.g., two laptops) via `MultiScreenMockupEntry` with per-screen click positions
- **Seed data**: `prisma/seed-config.ts` defines seed users, items, and metadata. `seedContentHash` (SHA-256) enables incremental seeding
- **Server component wrappers**: Remove padding from wrappers for full-bleed heroes — let `<Section>` component handle its own padding
- **Legal pages**: MDX in `content/legal/`, rendered via second Fumadocs collection (`legalSource` in `lib/source.ts`). Route: `app/(public)/legal/[[...slug]]/page.tsx`

---

## File Quick Reference

| What you want to do | Where to look |
|---------------------|---------------|
| Add a server action | `lib/*-actions.ts` (follow parallel rate limit + auth pattern) |
| Add a Zod schema | `lib/validations.ts` |
| Add a rate limiter | `lib/rate-limit.ts` |
| Add a message constant | `lib/messages.ts` or `lib/constants/messages.ts` |
| Add a Prisma model | `prisma/schema.prisma` → `pnpm prisma migrate dev` |
| Add a UI component | `components/ui/` (shadcn/ui pattern) |
| Add a Storybook story | Co-located `*.stories.tsx` next to component |
| Add a unit test | `tests/unit/` (mock in `setup.ts` if needed) |
| Add an integration test | `tests/integration/` (uses real DB) |
| Add an E2E test | `e2e/journeys/` + POM in `e2e/pages/` |
| Add user documentation | `content/docs/` (MDX, British English) |
| Add a legal page | `content/legal/` (MDX) |
| Update deployment notes | `docs/deployments/DEPLOYMENT-{version}.md` |
| Change auth behaviour | `lib/auth.ts` (NextAuth config) + `lib/auth-actions.ts` |
| Change lockout settings | `lib/lockout-utils.ts` (LOCKOUT_THRESHOLD, LOCKOUT_DURATION_MS) |
| Update screenshots/mockups | `e2e/mockups/` (config, specs, utils) → `pnpm run mockups` |
