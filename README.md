# CanonCore

Media library platform with Google Drive sync. Built on Next.js 16, React 19, Prisma 7.

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, NextAuth.js v5, Prisma, PostgreSQL (Neon), Upstash Redis

## Commands

### Development
```bash
pnpm run dev          # Start dev server with Turbopack
pnpm run build        # Production build
pnpm run start        # Start production server
pnpm run check        # Run all checks (format, lint, type-check, knip, build)
```

### Database
```bash
npx prisma migrate dev      # Create and apply migrations
npx prisma generate         # Generate Prisma Client
npx prisma studio           # Open Prisma Studio
pnpm run seed:quick         # Incremental seed (~5-30s)
pnpm run seed:full          # Full clean slate seed (~2-3min)
```

### Code Quality
```bash
pnpm run format       # Format with Prettier
pnpm run lint         # Lint with ESLint
pnpm run type-check   # TypeScript type checking
pnpm run knip         # Check for unused code/dependencies
```

### Testing
```bash
# Unit & Integration Tests (Vitest)
pnpm run test              # Run unit tests
pnpm run test:unit         # Explicit unit tests
pnpm run test:integration  # Integration tests with real DB
pnpm run test:coverage     # Coverage report
pnpm run test:watch        # Watch mode

# E2E Tests (Playwright)
pnpm run test:e2e                           # All E2E tests
pnpm run test:e2e --project=chromium        # Desktop only
pnpm run test:e2e --project=mobile-chrome   # Mobile only
pnpm run test:e2e:debug                     # Debug mode
pnpm run test:e2e:ui                        # UI mode
```

### Setup Scripts
```bash
pnpm run setup:e2e       # Setup E2E Drive account
pnpm run setup:seed      # Setup seed Drive account
pnpm run setup:e2e-drive # Setup E2E test data
pnpm run setup:verify    # Verify Drive accounts
pnpm run setup:all       # Run both OAuth setups
```

## Project Structure

```
app/
├── (auth)/              # Auth pages (sign-in, sign-up, forgot/reset-password)
├── (public)/            # Public pages (landing, explore, /u/[username])
├── (docs)/              # Fumadocs documentation
├── api/                 # API routes
│   ├── artwork/[fileId]/route.ts  # Artwork streaming
│   ├── stream/[fileId]/route.ts   # Media streaming (Range headers)
│   └── user/avatar|hero/route.ts  # User images
└── globals.css

components/
├── items/               # Items feature (30+ components)
├── google-drive/        # Drive integration UI
├── sortable-grid/       # Grid drag-and-drop (dnd-kit)
├── sortable-tree/       # Tree drag-and-drop (dnd-kit)
├── search/              # Spotlight search
├── profile/             # User profile components
└── ui/                  # shadcn/ui primitives

lib/
├── *-actions.ts         # Server actions
├── *-client.ts          # External API clients (google-drive, tmdb)
├── *-utils.ts           # Feature utilities
├── auth.ts              # NextAuth config
├── prisma.ts            # Prisma client
├── types.ts             # Shared TypeScript types
└── validations.ts       # Zod schemas

prisma/
├── schema.prisma        # Database schema
├── seed.ts              # Seeding logic
└── seed-config.ts       # Seed user definitions

tests/unit/              # Vitest unit tests (mocked)
tests/integration/       # Vitest integration tests (real DB)
e2e/journeys/            # Playwright E2E tests by feature
e2e/pages/               # Page Object Models
e2e/fixtures/            # Reusable test fixtures
```

## Environment Variables

Required:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret (generate: `openssl rand -base64 32`)
- `RESEND_API_KEY` - Resend API key for password reset emails
- `EMAIL_FROM` - Sender email (default: `noreply@canoncore.com`)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token
- `ENCRYPTION_KEY` - Base64 32-byte key (generate: `openssl rand -base64 32`)

Google Drive (required for Drive integration):
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

TMDB (optional):
- `TMDB_API_KEY` - TMDB v3 API key for metadata

Seed (required for seeding):
- `GOOGLE_SEED_REFRESH_TOKEN` - Seed Drive account token
- `GOOGLE_SEED_ROOT_FOLDER_ID` - Folder ID where seed creates content
- `GOOGLE_SEED_EMAIL` - Email of seed account (optional)

E2E Testing (optional):
- `GOOGLE_E2E_REFRESH_TOKEN` - E2E test Drive account token
- `GOOGLE_E2E_ROOT_FOLDER_ID` - Folder ID for E2E tests
- `GOOGLE_E2E_EMAIL` - Email of E2E test account (optional)

Optional:
- `BYPASS_RATE_LIMIT` - Set to `"true"` to skip rate limiting (E2E tests only)
- `NEXT_PUBLIC_APP_URL` - Base URL for email links (default: `http://localhost:3000`)
- `LOG_LEVEL` - Pino log level: debug, info, warn, error (default: info)
- `SEED_INCREMENTAL` - Set to `false` to force full rebuild (default: true)

## Branching Strategy

| Git Branch    | Neon Branch   | Vercel Environment |
| ------------- | ------------- | ------------------ |
| `development` | `development` | Preview            |
| `production`  | `production`  | Production         |

Local dev uses `.env.local` pointing to Neon `development` branch.
Vercel production uses environment variables for Neon `production` branch.

## Key Patterns

**Server Actions Convention:**
- All server actions in `lib/*-actions.ts`
- Parallel async execution for rate limit + auth checks
- Zod schemas from `lib/validations.ts`

**Route Groups:**
- `app/(auth)/` - Auth pages with redirect guard layout
- `app/(public)/` - Public pages (landing, explore, profiles)
- `app/(docs)/` - Fumadocs documentation

**Component Organization:**
- Items feature: 30+ components in `components/items/`
- Google Drive UI: `components/google-drive/`
- Drag-and-drop: `sortable-grid/` and `sortable-tree/` (dnd-kit)
- shadcn/ui: `components/ui/` (don't document these)

**Database Schema:**
- Self-referential hierarchy: `Item.parentId` for unlimited nesting
- Inherited visibility: `Item.inheritVisibility` for public/private cascading
- Google Drive sync: `Item.driveFileId`, `syncStatus`, `driveModifiedAt`
- Progress tracking: `ItemFile.playbackPosition` (90% threshold for "watched")

**Testing:**
- Unit tests: `tests/unit/` with mocked Prisma, email, rate-limit
- Integration tests: `tests/integration/` with real database
- E2E tests: `e2e/journeys/` with Page Object Model pattern
- Coverage configured for `lib/**` only

## Documentation

See [DESIGN.md](./DESIGN.md) for detailed architecture, API design, and implementation decisions.
