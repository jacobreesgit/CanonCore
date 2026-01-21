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
│   │   ├── explore/page.tsx          # Browse public collections
│   │   ├── u/[username]/page.tsx     # Public profile page
│   │   ├── u/[username]/[itemId]/page.tsx  # Public item detail
│   │   ├── layout.tsx                # Public layout with guest sidebar
│   │   └── page.tsx                  # Public landing page
│   ├── api/
│   │   ├── artwork/[fileId]/route.ts    # Google Drive artwork streaming
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts   # NextAuth API route
│   │   │   └── callback/google-drive/route.ts  # OAuth callback
│   │   ├── fork/[itemId]/route.ts       # Fork public items to library
│   │   ├── stream/[fileId]/route.ts     # Stream media from Google Drive
│   │   ├── user/
│   │   │   ├── avatar/route.ts          # User avatar image endpoint
│   │   │   └── hero/route.ts            # User hero banner endpoint
│   │   └── username/check/route.ts      # Username availability check
│   ├── globals.css
│   └── layout.tsx                    # Root layout with providers
├── components/
│   ├── google-drive/                 # Google Drive integration
│   │   ├── oauth-toast.tsx           # OAuth result notifications
│   │   ├── pending-indicator.tsx     # Pending sync operations badge
│   │   ├── settings-section.tsx      # Drive connection UI in Settings
│   │   ├── storage-bar.tsx           # Storage quota progress bar
│   │   └── sync-history.tsx          # Sync activity history panel
│   ├── items/                        # Items feature components
│   │   ├── add-item-dialog.tsx       # Modal dialog for item creation with TMDB search
│   │   ├── bulk-actions-toolbar.tsx  # Select-all checkbox and bulk delete button
│   │   ├── edit-mode-toggle.tsx      # Edit/Done button for reordering mode
│   │   ├── empty-state.tsx           # Context-aware empty state (first-time, no-children, filter-empty)
│   │   ├── episode-picker-helpers.tsx # Shared season/episode picker components
│   │   ├── file-type-combobox.tsx    # File type picker with uploadOnly mode for Add dialog
│   │   ├── files-section.tsx         # File display section for settings dialog
│   │   ├── filter-dropdown.tsx       # Filter option dropdown (all, has-files, synced, etc.)
│   │   ├── fork-destination-dialog.tsx # Folder picker for placing forked items
│   │   ├── hero-selection-step.tsx   # Wizard step for backdrop/hero selection
│   │   ├── image-selection-grid.tsx  # Grid for selecting TMDB/existing artwork
│   │   ├── item-context-menu.tsx     # Right-click actions menu
│   │   ├── item-detail-client.tsx    # Client wrapper with hero and media player
│   │   ├── item-dialog-tabs.tsx      # Tabbed interface for Add/Edit dialogs
│   │   ├── item-hero.tsx             # Hero banner with artwork, title, play/go-to buttons, reduced motion support
│   │   ├── item-settings-dialog.tsx  # Settings with file selection and upload
│   │   ├── item-stats.tsx            # Reusable child/file count stats display
│   │   ├── items-toolbar.tsx         # Unified toolbar for root and detail pages
│   │   ├── items-view.tsx            # Main view with tree/grid/edit/sort/filter
│   │   ├── media-search-combobox.tsx # TMDB search with poster thumbnails
│   │   ├── mobile-options-sheet.tsx  # Mobile drawer for Sort/Filter options
│   │   ├── parent-privacy-warning-dialog.tsx  # Warning when making item public with private parent
│   │   ├── poster-selection-step.tsx # Wizard step for poster selection
│   │   ├── queued-file-thumbnail.tsx # Thumbnail preview for queued uploads
│   │   ├── reparent-warning-dialog.tsx  # Warning when moving items affects visibility
│   │   ├── sort-dropdown.tsx         # Sort option dropdown (name, date, custom)
│   │   ├── sync-badge.tsx            # Google Drive sync status indicators
│   │   ├── title-description-step.tsx # Wizard step for name/description options
│   │   ├── view-toggle.tsx           # Tree/grid view switcher
│   │   └── visibility-toggle.tsx     # Public/private toggle with inheritance support
│   ├── media/                        # Media playback components
│   │   ├── media-overlay.tsx         # Full-screen media viewer
│   │   └── media-player.tsx          # Vidstack video player wrapper
│   ├── profile/                      # User profile components
│   │   ├── index.ts                  # Barrel export for profile components
│   │   ├── preferences-tab.tsx       # Preferences tab (default view mode, sort)
│   │   └── settings-dialog.tsx       # Tabbed settings with profile and preferences
│   ├── search/                       # Spotlight search components
│   │   ├── global-spotlight.tsx      # Wrapper that renders SpotlightSearch
│   │   ├── spotlight-search.tsx      # Main search dialog with fuzzy filtering
│   │   └── user-thumbnail.tsx        # User avatar thumbnail with fallback
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
│   ├── deferred-analytics.tsx        # Deferred Vercel Analytics loader
│   ├── ui/                           # shadcn/ui + animated-dialog-content.tsx, checkbox.tsx, command.tsx, drawer.tsx, dropzone.tsx, kbd.tsx, password-input.tsx, progress.tsx, radio-group.tsx, scroll-area.tsx, select.tsx, tabs.tsx
│   ├── app-sidebar.tsx               # Context-aware navigation sidebar
│   ├── error-boundary.tsx            # React error boundary for graceful error handling
│   ├── my-items-providers.tsx        # Client-side providers for protected routes
│   ├── nav-docs.tsx                  # Docs tree navigation (Fumadocs)
│   ├── nav-guest.tsx                 # Guest navigation with auth buttons
│   ├── nav-main.tsx                  # Main navigation items
│   ├── nav-pinned-items.tsx          # Pinned items sidebar section
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
│   │   ├── media/                    # Media playback tests
│   │   ├── navigation/               # Sidebar navigation active state tests
│   │   ├── profile/                  # Profile settings tests
│   │   ├── public/                   # Public profiles and forking tests
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
│   │   ├── hooks/                    # Hook tests (upload, state, navigation, mobile)
│   │   ├── lib/                      # Library tests (auth, items, google-drive, crypto)
│   │   ├── e2e/                      # E2E fixture unit tests
│   │   ├── setup.ts                  # Mocks for Prisma (client + errors), email, rate-limit
│   │   └── vitest.config.ts
│   ├── integration/
│   │   ├── auth/                     # Auth integration tests
│   │   ├── e2e-setup/                # E2E auto-setup integration tests
│   │   ├── google-drive/             # Google Drive integration tests (batch operations)
│   │   ├── items/                    # Items integration tests (CRUD, hierarchy)
│   │   ├── public/                   # Public profile and fork integration tests
│   │   ├── seed/                     # Seed system integration tests
│   │   ├── user/                     # User profile integration tests
│   │   ├── setup.ts                  # DB cleanup, env loading, rate-limit bypass
│   │   └── vitest.config.ts
│   └── vitest.config.ts              # Base Vitest config
├── contexts/
│   └── spotlight-context.tsx         # Spotlight search state and "/" keyboard shortcut
├── hooks/
│   ├── use-artwork-upload.ts         # Artwork upload flow with progress
│   ├── use-bulk-selection.ts         # Bulk item selection with select-all/toggle
│   ├── use-controllable-state.ts     # Controlled/uncontrolled component state
│   ├── use-explore-sort.ts           # Explore page sort with localStorage persistence
│   ├── use-go-to-item.ts             # Fetch first incomplete item and navigate for "Go to" button
│   ├── use-hero-collapse.ts          # Hero section scroll-triggered collapse
│   ├── use-image-loaded.ts           # Cached image detection for reliable loading
│   ├── use-items-sort-filter.ts      # Sort/filter state with localStorage persistence
│   ├── use-lazy-image.ts             # Intersection Observer lazy loading with priority
│   ├── use-mobile.ts                 # Mobile breakpoint hook
│   ├── use-online-status.ts          # Browser online/offline status hook
│   ├── use-tree-collapse.ts          # Shared tree collapse/expand state
│   └── use-username-validation.ts    # Username availability check with debounce
├── content/
│   └── docs/                         # MDX documentation pages (28 files)
├── lib/
│   ├── auth.ts                       # NextAuth config, extractSidebarUser helper
│   ├── auth-actions.ts               # Auth server actions
│   ├── circuit-breaker.ts            # Circuit breaker for resilient external calls
│   ├── crypto.ts                     # AES-256-GCM credential encryption
│   ├── drive-verification.ts         # Drive credential validation for E2E/seed
│   ├── e2e-setup.ts                  # Automatic E2E setup and recovery utilities
│   ├── email.ts                      # Resend email helper
│   ├── env.ts                        # Zod environment variable validation
│   ├── errors.ts                     # Centralized Prisma error handling
│   ├── config/usernames.ts           # Username validation rules and constants
│   ├── file-type-utils.ts            # Media/artwork/subtitle categorization
│   ├── fork-actions.ts               # Fork server actions (forkItem, getForkStatus, getForkInfo)
│   ├── google-drive-actions.ts       # Google Drive connection management
│   ├── google-drive-batch.ts         # Batch API request/response handling
│   ├── google-drive-client.ts        # Google Drive API client with OAuth
│   ├── google-drive-sync.ts          # Bidirectional sync operations
│   ├── google-drive-upload.ts        # Browser-to-Drive upload operations
│   ├── item-actions.ts               # Item CRUD server actions
│   ├── item-file-actions.ts          # ItemFile operations, playback progress
│   ├── item-utils.ts                 # Tree/flat conversion, sortItems(), filterItems(), sortPublicItems(), publicItemsToTree(), EXPLORE_SORT_OPTIONS
│   ├── logger.ts                     # Pino structured logging with request context
│   ├── prisma.ts                     # Prisma client singleton
│   ├── progress-utils.ts             # Playback progress calculation (90% threshold), DFS traversal for first incomplete item
│   ├── public-auth.ts                # Public profile/item auth utilities (isItemFullyPublic, getPublicItems, getPublicChildItems, searchPublicUsers, searchPublicItems)
│   ├── queue-aware-actions.ts        # Actions that queue when offline
│   ├── rate-limit.ts                 # Upstash Redis rate limiting
│   ├── source.ts                     # Fumadocs source configuration
│   ├── sync-log.ts                   # Sync history server actions
│   ├── sync-queue.ts                 # IndexedDB queue for offline operations
│   ├── sync-queue-processor.ts       # Queue retry with exponential backoff
│   ├── sync-utils.ts                 # Shared sync types and utilities
│   ├── tmdb-actions.ts               # TMDB metadata server actions
│   ├── tmdb-client.ts                # TMDB API client for movie/TV metadata
│   ├── types.ts                      # Shared types (Item, ItemFile, ItemProgress, PinnedItem, NextItem, PublicProfile, PublicItem, ForkStatus, ForkInfo, SortOption, FilterOption, ViewMode, QueuedFile, TMDBMetadataSelection, SyncLogEntry, InheritVisibilityItem, SearchableUser, SearchablePublicItem)
│   ├── upload-utils.ts               # Browser-to-Drive upload utilities
│   ├── user-actions.ts               # User profile server actions
│   ├── utils.ts                      # cn() helper
│   └── validations.ts                # Zod schemas (auth, items, uploads, username)
├── prisma/
│   ├── migrations/                   # Database migrations
│   ├── schema.prisma                 # User, PasswordReset, Item, ItemFile, GoogleDriveConnection, SyncLog, Fork
│   ├── seed.ts                       # Database seeding with TMDB + Drive integration (auto-cleans Drive first)
│   └── seed-config.ts                # Seed configuration (movie/TV IDs, limits, playback simulation)
├── proxy.ts                          # Next.js proxy for request ID injection
├── skills/                           # Claude Code skills
│   ├── code-review-excellence/       # Code review best practices
│   ├── docs-write/                   # Documentation writing style
│   ├── frontend-design/              # Frontend interface design
│   ├── react-best-practices/         # React optimization rules (50+)
│   └── web-design-guidelines/        # Frontend design principles
├── scripts/
│   ├── generate-refresh-token.ts     # Google Drive token generator with --purpose flag
│   ├── setup-e2e-drive.ts            # E2E Drive environment setup
│   ├── verify-drive-setup.ts         # Validate Drive accounts are configured correctly
│   └── verify-seed.ts                # Quick seed verification utility
└── docs/
    ├── deployments/                  # Deployment summaries (0.2.0 - 4.6.0)
    └── plans/                        # Design documents and audit reports
```

### Authentication

- **NextAuth.js v5** with Credentials provider for email/password auth
- Server-side auth: `lib/auth.ts` exports `auth()` function
- Client-side: `signIn()` and `signOut()` from `next-auth/react`
- Server actions: `signUp()`, `forgotPassword()`, `resetPassword()` in `lib/auth-actions.ts`
- Protected routes use `await auth()` + redirect in server components
- Password hashing with bcryptjs
- Password reset emails via Resend (30 min expiry)
- **Rate limiting**: Upstash Redis for auth (sign-in: 5/min, sign-up: 3/min, forgot: 2/min), items (create: 30/min, update: 60/min, delete: 30/min, pin: 30/min), public features (fork: 10/min, username: 20/min), and search (userSearch: 60/min, publicItemSearch: 60/min)
- **Validation**: Zod schemas for email/password (8+ chars, uppercase, lowercase, number)
- **Security logging**: All auth events logged with IP and timestamp

### Database

- **Prisma 7** with PostgreSQL (Neon)
- Schema: User, PasswordReset, Item, ItemFile, GoogleDriveConnection, Fork models
- User has optional `image`/`heroImage` blob fields for avatar and hero banner
- User has optional `defaultViewMode`/`defaultSortBy` for preferences (String?, not enum for flexibility)
- User has optional `username` (unique, case-insensitive) and `isPublic` for public profiles
- Item has self-referential parent/child relationships for hierarchy
- Item has optional `description` field (max 1000 chars) for TMDB overviews or notes
- Item has optional `pinnedOrder` field for sidebar pinning (null = not pinned, 0+ = pinned with order)
- Item has optional `isPublic` for visibility, `inheritVisibility` for parent inheritance, and `forkedFromId` for fork tracking
- Item has Google Drive fields: `driveFileId`, `driveModifiedAt`, `syncStatus`, `driveConnectionId`
- Fork tracks item copies: `sourceItemId`, `targetItemId`, `userId` with unique constraint on source+user
- ItemFile stores files per item: `filename`, `driveFileId`, `fileType`, `mimeType`, `playbackPosition`, `isPrimary`, `isHero`
- GoogleDriveConnection stores encrypted OAuth tokens with AES-256-GCM
- SyncLog tracks sync operations with action type, status, and duration
- Enums: `FileType` (MEDIA, ARTWORK, SUBTITLE), `SyncStatus` (SYNCED, PENDING, SYNCING, ERROR), `SyncLogAction` (CREATE, RENAME, DELETE, MOVE, UPLOAD, DOWNLOAD, SYNC), `SyncLogStatus` (SUCCESS, FAILED, PENDING)
- Config in `prisma.config.ts` (loads DATABASE_URL from .env.local)
- Run migrations: `npx prisma migrate dev`

### Items System

- **Hierarchical items** with drag-and-drop reordering via dnd-kit
- **Hero banners**: Item detail pages show cinematic hero with artwork, title, and play button
- **Dual view modes**: Tree (hierarchical) and Grid (movie poster cards)
- **Sort options**: Custom Order, Name A-Z/Z-A, Newest/Oldest, Recently Updated
- **Filter options**: All Items, Has Files, No Files, Synced, Pending
- **Edit mode toggle**: Click "Edit" to enable drag-and-drop, "Done" to return to view mode (disabled when not custom sort)
- **Mobile-responsive toolbar**: Sort/Filter collapse into swipe-up drawer on mobile; buttons show icons only
- **View mode**: Full background artwork with dark overlay (Feature222 aesthetic)
- **Edit mode**: Simplified icons with drag handles for reordering
- **Add Item dialog**: Modal with TMDB search combobox for auto-filling metadata
- **Server actions**: `createItem`, `updateItem`, `deleteItem`, `deleteItems`, `reorderItems`, `getSearchableItems`, `pinItem`, `unpinItem`, `getPinnedItems`, `getFirstIncompleteItem`, `updateVisibility`, `updateInheritVisibility` in `lib/item-actions.ts` (parallel async for rate limit + auth)
- **Bulk delete**: Edit mode shows checkboxes for multi-select; select-all in toolbar; confirmation dialog before deletion
- **Contextual empty states**: Different messages for first-time users, empty folders, and filter results with actionable buttons
- **Breadcrumb navigation** for item drill-down
- **Pinned items**: Pin up to 10 items to sidebar for quick access; "Pinned" section with folder icons
- **Context menu**: Right-click for Settings, Pin/Unpin, Delete, Add Child Item
- **Settings dialog**: Rename items, add descriptions, select primary/hero files, upload files
- **Item descriptions**: Optional 1000-character notes (for TMDB overviews), displayed in view mode
- **Primary file selection**: Choose which file plays/displays when multiple files attached
- **Hero artwork selection**: Choose separate artwork for hero banner display (isHero field)
- **Sync status badges**: Visual indicators showing sync state (synced, pending, error)
- **Progress tracking**: Progress bars show watched/total items across hierarchies (90% threshold for "watched")
- **Go to button**: "Go to [ItemName]" button navigates to first incomplete item in DFS order for continue watching workflow
- **Toast notifications**: Success/error feedback via Sonner
- **Max depth**: 10 levels of nesting

### Public Profiles & Forking

- **Public profiles**: Users can enable public visibility with unique username at `/u/[username]`
- **Username validation**: 3-20 chars, alphanumeric + underscores, no leading numbers, case-insensitive uniqueness
- **Item visibility**: Items can be made public/private independently via toggle in settings
- **Inherited visibility**: Items can inherit visibility from parent (`inheritVisibility: true`) - reduces Explore clutter while maintaining deep links
- **Fully public check**: Item is only viewable when profile AND all ancestor items are public (handles inheritance)
- **Explore page**: Shows only explicitly public items (not inheriting) at `/explore`
- **Forking**: Copy public items to your library with `forkItem()` server action
- **Fork rules**: Cannot fork own items, cannot fork same item twice, forked items start private with `inheritVisibility: false`
- **Fork destination dialog**: Choose root or any folder when forking, virtualized for large libraries
- **Fork attribution**: Shows "Forked from [name] by @username" and fork count on public items
- **Sidebar navigation**: Explore link shown for both authenticated and guest users
- **Server actions**: `forkItem()`, `getForkStatus()`, `getForkInfo()` in `lib/fork-actions.ts`
- **Public auth utilities**: `getPublicProfile()`, `getPublicItems()`, `getPublicChildItems()`, `isItemFullyPublic()`, `searchPublicUsers()`, `searchPublicItems()` in `lib/public-auth.ts` (React.cache() for request deduplication)

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
- **Three sections**: "Your Items" (own library), "Public Collections" (public items from others), "People" (public profiles)
- **Fuzzy filtering**: cmdk library handles client-side fuzzy search
- **Artwork thumbnails**: Search results display item artwork (primary first, then first available)
- **User thumbnails**: People results show avatar or initials-based fallback
- **Breadcrumb paths**: Nested items show parent hierarchy (e.g., "Movies / Star Wars")
- **Owner attribution**: Public items show @username for context
- **SWR-style caching**: 60-second TTL module-level cache for instant results
- **Independent loading**: Each section loads and renders independently with skeletons
- **Parallel fetching**: All three sections fetch concurrently
- **Available everywhere**: Works on all pages for authenticated users (my-items, docs, homepage)
- **Rate limiting**: Search requests limited (itemSearch: 30/min, userSearch: 60/min, publicItemSearch: 60/min)
- **Context**: `SpotlightProvider` manages dialog state and keyboard listener
- **Components**: `SpotlightSearch` dialog, `GlobalSpotlight` wrapper, `UserThumbnail`, `Kbd` keyboard hint

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
- **Offline sync queue**: IndexedDB-based queue for operations when offline (max 100 ops, 5 retries, exponential backoff)
- **Sync history**: Server-side audit log of sync operations with success/failure status
- **Storage quota display**: Visual progress bar with warning (80%) and critical (95%) states
- **Batch API**: Combines multiple operations into single HTTP requests (max 100 per batch)
- **Pending indicator component**: PendingIndicator component available for showing queued operation count

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
- **28 pages** covering getting started, account, files/folders, google-drive, views, sharing, and preferences
- **Unified layout** with context-aware sidebar navigation using app sidebar shell
- **NavDocs component** renders Fumadocs page tree with collapsible folders
- Content in `content/docs/` with `meta.json` for structure
- Source config in `source.config.ts` and `lib/source.ts`

### Dark Mode

- **next-themes** for theme management with system preference detection
- **ThemeProvider** wraps app in `app/layout.tsx`
- **ThemeToggle** button in header with sun/moon icons
- **color-scheme CSS**: Browser-native dark mode for scrollbars and form controls
- Preference persists to localStorage

### Accessibility

- **Skip link**: "Skip to main content" for keyboard/screen reader navigation (WCAG 2.1 Level A)
- **Reduced motion**: `@media (prefers-reduced-motion)` disables animations globally
- **Component support**: `useReducedMotion` in item-hero and other animated components
- **Touch optimization**: 300ms tap delay removal, iOS highlight suppression
- **Safe area support**: CSS variables for notched devices (iPhone X+)
- **Decorative icons**: `aria-hidden="true"` on non-interactive icons

### Unit & Integration Testing

- **Vitest** for fast unit and integration tests
- Unit tests in `tests/unit/` - mock Prisma and email
- Integration tests in `tests/integration/` - real database
- Coverage configured for `lib/**`
- 2300+ unit tests covering auth, items, Google Drive, crypto, API routes, media components, profile modals, dropzone, spotlight search, TMDB integration, sort/filter, seed system, sync queue, sync history, image loading hooks, bulk selection, empty states, pinned items, progress tracking, public profiles, forking, username validation, rate limiting, error handling, tree utilities, visibility inheritance

### E2E Testing

- **Playwright** with Page Object Model pattern
- Tests in `e2e/journeys/` organized by feature (auth, docs, google-drive, items, media, navigation, profile, public, security, theme)
- Page objects in `e2e/pages/` for reusable interactions
- Fixtures in `e2e/fixtures/` for auth, database, and Google Drive setup
- Google Drive E2E tests use real test account with refresh token
- Runs on desktop Chrome and mobile Chrome (iPhone 14)

**Intentionally Skipped Tests:**

| Test                             | File                         | Reason                                                                     |
| -------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Google Drive media tests (all 4) | `drive-media.spec.ts:23`     | Skipped on mobile - sync and media playback unreliable in mobile emulation |
| Video playback test              | `drive-media.spec.ts:118`    | Dynamic skip if no video file in `GOOGLE_E2E_ROOT_FOLDER_ID/Breaking Bad/` |
| File Deletion tests (5)          | `items-settings.spec.ts:409` | Skipped if `GOOGLE_E2E_REFRESH_TOKEN` not set                              |

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

- `GOOGLE_SEED_REFRESH_TOKEN` - Refresh token for seed Drive account
- `GOOGLE_SEED_ROOT_FOLDER_ID` - Folder ID where seed creates content
- `GOOGLE_SEED_EMAIL` - Email of seed account (optional, for display)

E2E Testing (optional - for Google Drive E2E tests):

- `GOOGLE_E2E_REFRESH_TOKEN` - Refresh token for E2E test Drive account
- `GOOGLE_E2E_ROOT_FOLDER_ID` - Folder ID where E2E tests create/delete items
- `GOOGLE_E2E_EMAIL` - Email of E2E test account (optional, for display)

**Setup Scripts:**

```bash
pnpm run setup:e2e       # Setup E2E Drive account (interactive OAuth flow)
pnpm run setup:seed      # Setup seed Drive account (interactive OAuth flow)
pnpm run setup:e2e-drive # Setup E2E test data (wipe, upload video)
pnpm run setup:verify    # Verify both accounts are configured correctly
pnpm run setup:all       # Run both OAuth setups sequentially
```

**E2E Drive Setup Workflow:**

1. **First-time setup** (run once, uploads 474MB video):

   ```bash
   pnpm run setup:e2e-drive
   ```

   - Wipes all contents in E2E folder
   - Empties trash
   - Creates "Breaking Bad" folder
   - Uploads test video

2. **Run E2E tests** (fast, just verifies):

   ```bash
   pnpm run test:e2e
   ```

   - Cleans test-created items (keeps "Breaking Bad")
   - Verifies baseline data exists
   - Runs tests

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
