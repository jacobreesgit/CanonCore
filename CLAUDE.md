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
│   ├── (my-items)/
│   │   ├── my-items/
│   │   │   ├── [itemId]/page.tsx     # Item detail with children
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
│   │   ├── artwork/[fileId]/route.ts    # Google Drive artwork streaming
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts   # NextAuth API route
│   │   │   └── callback/google-drive/route.ts  # OAuth callback
│   │   ├── stream/[fileId]/route.ts     # Stream media from Google Drive
│   │   └── user/
│   │       ├── avatar/route.ts          # User avatar image endpoint
│   │       └── hero/route.ts            # User hero banner endpoint
│   ├── globals.css
│   └── layout.tsx                    # Root layout with providers
├── components/
│   ├── google-drive/                 # Google Drive integration
│   │   ├── oauth-toast.tsx           # OAuth result notifications
│   │   └── settings-section.tsx      # Drive connection UI in Settings
│   ├── items/                        # Items feature components
│   │   ├── add-item-dialog.tsx       # Modal dialog for item creation with TMDB search
│   │   ├── edit-mode-toggle.tsx      # Edit/Done button for reordering mode
│   │   ├── episode-picker-helpers.tsx # Shared season/episode picker components
│   │   ├── file-type-combobox.tsx    # File type picker with uploadOnly mode for Add dialog
│   │   ├── files-section.tsx         # File display section for settings dialog
│   │   ├── hero-selection-step.tsx   # Wizard step for backdrop/hero selection
│   │   ├── image-selection-grid.tsx  # Grid for selecting TMDB/existing artwork
│   │   ├── item-context-menu.tsx     # Right-click actions menu
│   │   ├── item-detail-client.tsx    # Client wrapper with hero and media player
│   │   ├── item-dialog-tabs.tsx      # Tabbed interface for Add/Edit dialogs
│   │   ├── item-hero.tsx             # Hero banner with artwork, title, play button
│   │   ├── item-settings-dialog.tsx  # Settings with file selection and upload
│   │   ├── item-stats.tsx            # Reusable child/file count stats display
│   │   ├── items-toolbar.tsx         # Unified toolbar for root and detail pages
│   │   ├── items-view.tsx            # Main view with tree/grid/edit toggle
│   │   ├── media-search-combobox.tsx # TMDB search with poster thumbnails
│   │   ├── poster-selection-step.tsx # Wizard step for poster selection
│   │   ├── queued-file-thumbnail.tsx # Thumbnail preview for queued uploads
│   │   ├── sync-badge.tsx            # Google Drive sync status indicators
│   │   ├── title-description-step.tsx # Wizard step for name/description options
│   │   └── view-toggle.tsx           # Tree/grid view switcher
│   ├── media/                        # Media playback components
│   │   ├── media-overlay.tsx         # Full-screen media viewer
│   │   └── media-player.tsx          # Vidstack video player wrapper
│   ├── profile/                      # User profile components
│   │   ├── index.ts                  # Barrel export for profile components
│   │   └── settings-dialog.tsx       # Settings with step-based password/email changes
│   ├── search/                       # Spotlight search components
│   │   ├── global-spotlight.tsx      # Wrapper that renders SpotlightSearch
│   │   └── spotlight-search.tsx      # Main search dialog with fuzzy filtering
│   ├── sortable-grid/                # Grid view with drag-drop
│   │   ├── Grid.tsx                  # View-only grid (no dnd-kit)
│   │   ├── GridItem.tsx              # Card display component
│   │   ├── SortableGrid.tsx          # dnd-kit grid container (edit mode)
│   │   └── SortableGridItem.tsx      # Draggable grid item wrapper
│   ├── sortable-tree/                # Tree view with drag-drop
│   │   ├── components/TreeItem/      # Tree node components
│   │   ├── Tree.tsx                  # View-only tree (no dnd-kit)
│   │   ├── SortableTree.tsx          # dnd-kit tree container (edit mode)
│   │   ├── keyboardCoordinates.ts    # Keyboard navigation
│   │   └── utilities.ts              # Tree manipulation helpers
│   ├── providers/
│   │   └── theme-provider.tsx        # next-themes provider wrapper
│   ├── ui/                           # shadcn/ui + animated-dialog-content.tsx, checkbox.tsx, command.tsx, dropzone.tsx, kbd.tsx, password-input.tsx, scroll-area.tsx, tabs.tsx
│   ├── app-sidebar.tsx               # Context-aware navigation sidebar
│   ├── error-boundary.tsx            # React error boundary for graceful error handling
│   ├── my-items-providers.tsx        # Client-side providers for protected routes
│   ├── nav-docs.tsx                  # Docs tree navigation (Fumadocs)
│   ├── nav-guest.tsx                 # Guest navigation with auth buttons
│   ├── nav-main.tsx                  # Main navigation items
│   ├── nav-user.tsx                  # User dropdown menu
│   ├── site-header.tsx               # Top header bar with breadcrumbs
│   └── theme-toggle.tsx              # Dark/light mode toggle
├── e2e/
│   ├── fixtures/                     # Playwright fixtures (auth, db, google-drive)
│   ├── helpers/                      # Test utilities (test-user.ts)
│   ├── journeys/
│   │   ├── auth/                     # Auth E2E tests
│   │   ├── docs/                     # Documentation E2E tests
│   │   ├── google-drive/             # Google Drive integration tests
│   │   ├── items/                    # Items E2E tests (CRUD, drag, views, rate-limit)
│   │   ├── media/                    # Media playback tests (video seeking)
│   │   ├── navigation/               # Sidebar navigation active state tests
│   │   ├── profile/                  # Profile settings tests
│   │   ├── security/                 # Security header tests (HSTS, CSP)
│   │   ├── theme/                    # Dark mode E2E tests
│   │   ├── global.setup.ts           # Global test setup
│   │   └── global.teardown.ts        # Global test cleanup
│   ├── pages/                        # Page Object Models
│   └── playwright.config.ts
├── tests/
│   ├── unit/
│   │   ├── api/                      # API route tests (stream, artwork, user)
│   │   ├── components/               # Component tests (media, items, ui)
│   │   ├── lib/                      # Library tests (auth, items, google-drive, crypto)
│   │   ├── e2e/                      # E2E fixture unit tests
│   │   ├── setup.ts                  # Mocks for Prisma, email, rate-limit
│   │   └── vitest.config.ts
│   ├── integration/
│   │   ├── auth/                     # Auth integration tests
│   │   ├── items/                    # Items integration tests (CRUD, hierarchy)
│   │   ├── user/                     # User profile integration tests
│   │   ├── setup.ts                  # DB cleanup, env loading, rate-limit bypass
│   │   └── vitest.config.ts
│   └── vitest.config.ts              # Base Vitest config
├── contexts/
│   └── spotlight-context.tsx         # Spotlight search state and "/" keyboard shortcut
├── hooks/
│   ├── use-artwork-upload.ts         # Artwork upload flow with progress
│   ├── use-controllable-state.ts     # Controlled/uncontrolled component state
│   ├── use-hero-collapse.ts          # Hero section scroll-triggered collapse
│   ├── use-mobile.ts                 # Mobile breakpoint hook
│   └── use-tree-collapse.ts          # Shared tree collapse/expand state
├── content/
│   └── docs/                         # MDX documentation pages (20 files)
├── lib/
│   ├── auth.ts                       # NextAuth config, extractSidebarUser helper
│   ├── auth-actions.ts               # Auth server actions
│   ├── circuit-breaker.ts            # Circuit breaker for resilient external calls
│   ├── crypto.ts                     # AES-256-GCM credential encryption
│   ├── email.ts                      # Resend email helper
│   ├── env.ts                        # Zod environment variable validation
│   ├── file-type-utils.ts            # Media/artwork/subtitle categorization
│   ├── google-drive-actions.ts       # Google Drive connection management
│   ├── google-drive-client.ts        # Google Drive API client with OAuth
│   ├── google-drive-sync.ts          # Bidirectional sync operations
│   ├── google-drive-upload.ts        # Browser-to-Drive upload operations
│   ├── item-actions.ts               # Item CRUD server actions
│   ├── item-file-actions.ts          # ItemFile operations, playback progress
│   ├── item-utils.ts                 # Tree/flat conversion, descendant counter utilities
│   ├── logger.ts                     # Pino structured logging with request context
│   ├── prisma.ts                     # Prisma client singleton
│   ├── rate-limit.ts                 # Upstash Redis rate limiting
│   ├── source.ts                     # Fumadocs source configuration
│   ├── tmdb-actions.ts               # TMDB metadata server actions
│   ├── tmdb-client.ts                # TMDB API client for movie/TV metadata
│   ├── types.ts                      # Shared types (Item, ItemFile, QueuedFile, TMDBMetadataSelection, ArtworkSelectionSource)
│   ├── upload-utils.ts               # Browser-to-Drive upload utilities
│   ├── user-actions.ts               # User profile server actions
│   ├── utils.ts                      # cn() helper
│   └── validations.ts                # Zod schemas (auth, items, uploads)
├── prisma/
│   ├── migrations/                   # Database migrations
│   ├── schema.prisma                 # User, PasswordReset, Item, ItemFile, GoogleDriveConnection
│   ├── seed.ts                       # Database seeding with TMDB + Drive integration
│   ├── seed-config.ts                # Seed configuration (movie/TV IDs, limits)
│   └── seed-cleanup.ts               # Safe cleanup with protected folders
├── proxy.ts                          # Next.js proxy for request ID injection
├── skills/                           # Claude Code skills
│   ├── code-review-excellence/       # Code review best practices
│   ├── docs-write/                   # Documentation writing style
│   └── frontend-design/              # Frontend interface design
├── scripts/
│   ├── generate-refresh-token.ts     # Google Drive token generator for E2E tests
│   └── setup-e2e-drive.ts            # E2E Drive environment setup
└── docs/
    ├── deployments/                  # Deployment summaries (0.2.0 - 2.3.0)
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
- **Rate limiting**: Upstash Redis for auth (sign-in: 5/min, sign-up: 3/min, forgot: 2/min) and items (create: 30/min, update: 60/min, delete: 30/min)
- **Validation**: Zod schemas for email/password (8+ chars, uppercase, lowercase, number)
- **Security logging**: All auth events logged with IP and timestamp

### Database

- **Prisma 7** with PostgreSQL (Neon)
- Schema: User, PasswordReset, Item, ItemFile, GoogleDriveConnection models
- User has optional `image`/`heroImage` blob fields for avatar and hero banner
- Item has self-referential parent/child relationships for hierarchy
- Item has optional `description` field (max 1000 chars) for TMDB overviews or notes
- Item has Google Drive fields: `driveFileId`, `driveModifiedAt`, `syncStatus`, `driveConnectionId`
- ItemFile stores files per item: `filename`, `driveFileId`, `fileType`, `mimeType`, `playbackPosition`, `isPrimary`, `isHero`
- GoogleDriveConnection stores encrypted OAuth tokens with AES-256-GCM
- Enums: `FileType` (MEDIA, ARTWORK, SUBTITLE), `SyncStatus` (SYNCED, PENDING, SYNCING, ERROR)
- Config in `prisma.config.ts` (loads DATABASE_URL from .env.local)
- Run migrations: `npx prisma migrate dev`

### Items System

- **Hierarchical items** with drag-and-drop reordering via dnd-kit
- **Hero banners**: Item detail pages show cinematic hero with artwork, title, and play button
- **Dual view modes**: Tree (hierarchical) and Grid (movie poster cards)
- **Edit mode toggle**: Click "Edit" to enable drag-and-drop, "Done" to return to view mode
- **View mode**: Full background artwork with dark overlay (Feature222 aesthetic)
- **Edit mode**: Simplified icons with drag handles for reordering
- **Add Item dialog**: Modal with TMDB search combobox for auto-filling metadata
- **Server actions**: `createItem`, `updateItem`, `deleteItem`, `reorderItems`, `getSearchableItems` in `lib/item-actions.ts`
- **Breadcrumb navigation** for item drill-down
- **Context menu**: Right-click for Settings, Delete, Add Child Item
- **Settings dialog**: Rename items, add descriptions, select primary/hero files, upload files
- **Item descriptions**: Optional 1000-character notes (for TMDB overviews), displayed in view mode
- **Primary file selection**: Choose which file plays/displays when multiple files attached
- **Hero artwork selection**: Choose separate artwork for hero banner display (isHero field)
- **Sync status badges**: Visual indicators showing sync state (synced, pending, error)
- **Toast notifications**: Success/error feedback via Sonner
- **Max depth**: 10 levels of nesting

### TMDB Metadata Integration

- **Search combobox**: MediaSearchCombobox shows poster thumbnails as you type
- **Metadata wizard**: 3-step wizard for selective metadata application (text, poster, hero)
- **Unified dialogs**: Both Add Item and Item Settings use MediaSearchCombobox for name field
- **TV episode support**: Season/episode fetching for TV show metadata
- **Image galleries**: Fetch all posters and backdrops from TMDB for selection
- **Selective updates**: Choose which fields to update (name, description, poster, backdrop)
- **Graceful degradation**: Falls back to manual input if TMDB_API_KEY not configured
- **Circuit breaker**: Protects against TMDB API failures (5 failures, 60s recovery)
- **Rate limiting**: tmdbSearch, tmdbPreview, tmdbImages rate limits prevent abuse
- **Artwork uploads**: Downloads posters and backdrops, uploads to Google Drive
- **Server actions**: `searchMediaAction`, `applyMetadataAction`, `getMetadataPreviewAction`, `getImagesAction`, `getSeasonsAction`, `getEpisodesAction` in `lib/tmdb-actions.ts`
- **Client**: `lib/tmdb-client.ts` handles API calls with timeout, validation, and error handling

### Spotlight Search

- **Keyboard shortcut**: Press "/" to open search dialog from any page
- **Search button**: Sidebar button with "/" keyboard hint for mouse users
- **Fuzzy filtering**: cmdk library handles client-side fuzzy search
- **Artwork thumbnails**: Search results display item artwork (primary first, then first available)
- **Breadcrumb paths**: Nested items show parent hierarchy (e.g., "Movies / Star Wars")
- **SWR-style caching**: Shows cached results immediately while fetching fresh data
- **Available everywhere**: Works on all pages for authenticated users (my-items, docs, homepage)
- **Rate limiting**: Search requests limited to prevent abuse (itemSearch: 30/min)
- **Context**: `SpotlightProvider` manages dialog state and keyboard listener
- **Components**: `SpotlightSearch` dialog, `GlobalSpotlight` wrapper, `Kbd` keyboard hint

### Google Drive Integration

- **OAuth 2.0 authentication**: Secure OAuth flow with CSRF protection via signed state
- **Single connection**: One Google Drive account per user, managed in Settings dialog
- **Encrypted tokens**: AES-256-GCM encryption for access and refresh tokens
- **Auto token refresh**: Transparent refresh before expiry (5-minute buffer)
- **Bidirectional sync**: Sync folders/files between Google Drive and web interface
- **Auto-sync on connect**: Existing CanonCore folders are automatically synced when connecting
- **Browser uploads**: Direct browser-to-Drive uploads with progress tracking
- **Resumable uploads**: Google's resumable upload protocol for large files
- **Rate limiting**: Bottleneck library (10 concurrent, 100ms min interval) + exponential backoff
- **Artwork API**: `/api/artwork/[fileId]` streams artwork from Google Drive
- **Media streaming**: `/api/stream/[fileId]` with HTTP Range header support
- **Modular server actions**: `google-drive-actions.ts` (connection), `google-drive-sync.ts` (sync), `google-drive-upload.ts` (uploads)
- **Circuit breaker**: Protects against cascade failures (5 failures, 60s recovery)
- **Trashed folder detection**: Detects when CanonCore folder is in Trash and shows recovery guidance

### Media Playback

- **Video player**: Vidstack-based player with default controls
- **All media types**: Unified player for video, audio, and images
- **Subtitle support**: SRT, VTT, SUB, ASS subtitle tracks
- **Playback tracking**: Auto-save and resume playback position
- **File types**: MEDIA (video/audio), ARTWORK (images), SUBTITLE
- **Media overlay**: Full-screen viewer with tabbed file navigation
- **Range requests**: HTTP Range header support for video seeking
- **Google Drive streaming**: Stream media directly from Drive without downloading

### User Documentation

- **Fumadocs** for MDX-based documentation at `/docs`
- **20 pages** covering getting started, account, files/folders, google-drive, views, and preferences
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
- 964 unit tests covering auth, items, Google Drive, crypto, API routes, media components, profile modals, dropzone, spotlight search, TMDB integration, seed system

### E2E Testing

- **Playwright** with Page Object Model pattern
- Tests in `e2e/journeys/` organized by feature (auth, docs, google-drive, items, profile, theme)
- Page objects in `e2e/pages/` for reusable interactions
- Fixtures in `e2e/fixtures/` for auth, database, and Google Drive setup
- Google Drive E2E tests use real test account with refresh token
- Runs on desktop Chrome and mobile Chrome (iPhone 14)

**Intentionally Skipped Tests:**

| Test                             | File                         | Reason                                                                     |
| -------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Google Drive media tests (all 4) | `drive-media.spec.ts:23`     | Skipped on mobile - sync and media playback unreliable in mobile emulation |
| Video playback test              | `drive-media.spec.ts:118`    | Dynamic skip if no video file in `E2E_GOOGLE_ROOT_FOLDER_ID/Breaking Bad/` |
| Video seeking test               | `drive-media.spec.ts:169`    | Dynamic skip if no video file in test folder                               |
| File Deletion tests (5)          | `items-settings.spec.ts:409` | Skipped if `E2E_GOOGLE_REFRESH_TOKEN` not set                              |

### Security

- **OWASP security headers** configured in `next.config.mjs`
- **Strict-Transport-Security (HSTS)**: 1-year max-age with includeSubDomains and preload
- **Content Security Policy (CSP)**: Restricts resource loading to trusted sources
- **X-Frame-Options**: DENY prevents clickjacking via iframe embedding
- **X-Content-Type-Options**: nosniff prevents MIME-type sniffing
- **X-XSS-Protection**: Enables browser XSS filtering
- **Referrer-Policy**: strict-origin-when-cross-origin controls referrer leakage
- **Permissions-Policy**: Disables camera, microphone, and geolocation

### Observability

- **Structured logging**: Pino logger with JSON output in production, pretty print in development
- **Request tracing**: Middleware injects `x-request-id` header for distributed tracing
- **Child loggers**: `createRequestLogger(requestId)` and `createUserLogger(userId)` for context
- **Log levels**: Configurable via `LOG_LEVEL` env var (debug, info, warn, error)

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
- `ENCRYPTION_KEY` - Base64 32-byte key for credential encryption (generate with: `openssl rand -base64 32`)

Optional:

- `BYPASS_RATE_LIMIT` - Set to `"true"` to skip rate limiting (for E2E tests)
- `NEXT_PUBLIC_APP_URL` - Base URL for email links (default: `http://localhost:3000`)
- `LOG_LEVEL` - Pino log level: debug, info, warn, error (default: info)

Google Drive (required for Drive integration):

- `GOOGLE_CLIENT_ID` - OAuth client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - OAuth client secret from Google Cloud Console

TMDB (optional - for metadata lookup):

- `TMDB_API_KEY` - TMDB v3 API key for movie/TV metadata lookup

Seed (required for database seeding with Drive integration):

- `GOOGLE_TEST_REFRESH_TOKEN` - Refresh token for seed Drive account (seed@canoncore.com)
- `GOOGLE_TEST_ROOT_FOLDER_ID` - Folder ID where seed creates content
- `GOOGLE_TEST_EMAIL` - Email of seed account (optional, for display)

E2E Testing (optional - for Google Drive E2E tests):

- `E2E_GOOGLE_REFRESH_TOKEN` - Refresh token for E2E test Drive account (jacobreesmedia@gmail.com)
- `E2E_GOOGLE_ROOT_FOLDER_ID` - Folder ID where E2E tests create/delete items
- `E2E_GOOGLE_EMAIL` - Email of E2E test account (optional, for display)

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
