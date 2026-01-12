# Deployment 2.0.0 - TMDB Metadata Integration

**Date**: 2026-01-12
**Branch**: development

## Summary

Look up movies and TV shows directly from TMDB when adding items. The new media search combobox shows poster thumbnails and metadata as you type, then automatically applies the title, description, and poster artwork to your items. Combined with an expanded description field (now 1000 characters) and a complete seed system rewrite, this release brings rich metadata to your collection.

## Features

### Search TMDB from the Add Item dialog

When adding a new item, start typing to search The Movie Database. Results appear instantly with poster thumbnails, release years, and descriptions. Select a result to auto-fill the name and apply metadata.

The search uses debouncing (300ms) to avoid excessive API calls, and falls back to manual input if TMDB isn't configured.

### Apply metadata with poster artwork

Selecting a TMDB result applies:

- **Title with year**: "The Dark Knight (2008)" format
- **Description**: Movie/TV overview (truncated to 1000 chars)
- **Poster**: Downloaded and uploaded to Google Drive as hero artwork

The poster only uploads if the item has a Google Drive connection.

### Expanded description field

Item descriptions now support 1000 characters (up from 200). This accommodates TMDB overviews while still fitting on screen comfortably.

### Enhanced seed system

The database seeding system now creates realistic hierarchies with real TMDB metadata:

- **Movies folder**: 10 top-rated films with posters
- **TV Shows folder**: 10 shows with seasons and episodes
- **Configurable limits**: Control max seasons/episodes via environment variables
- **Google Drive integration**: Posters upload to Drive automatically
- **Safe cleanup**: Separate cleanup script with folder protection

Run seeding with:

```bash
ALLOW_SEEDING=true pnpm prisma db seed
```

## Files Changed

### Added

```
components/items/media-search-combobox.tsx           # TMDB search combobox
components/ui/scroll-area.tsx                        # shadcn ScrollArea component
lib/tmdb-actions.ts                                  # Server actions for TMDB operations
lib/tmdb-client.ts                                   # TMDB API client (server-side)
prisma/seed.ts                                       # Database seeding with TMDB + Drive
prisma/seed-config.ts                                # Seed configuration (movie/TV IDs)
prisma/seed-cleanup.ts                               # Safe cleanup with protected folders
prisma/migrations/20260112083339_expand_description_to_1000/  # Description field migration
e2e/journeys/items/media-lookup.spec.ts              # E2E tests for TMDB features
tests/integration/seed/seed.test.ts                  # Seed integration tests
tests/integration/tmdb/apply-metadata.test.ts        # TMDB metadata integration tests
tests/unit/components/items/media-search-combobox.test.tsx    # Combobox unit tests
tests/unit/lib/tmdb-actions.test.ts                  # TMDB actions unit tests
tests/unit/lib/tmdb-client.test.ts                   # TMDB client unit tests
tests/unit/prisma/seed.test.ts                       # Seed unit tests
docs/plans/2026-01-11-seed-hierarchy-enhancement.md  # Seed system design doc
docs/plans/2026-01-11-tmdb-metadata-integration.md   # TMDB integration design doc
docs/plans/2026-01-12-item-hero-and-metadata-enhancements.md  # Hero enhancements doc
docs/plans/2026-01-12-tmdb-metadata-wizard.md        # Metadata wizard planning
```

### Modified

```
components/items/add-item-dialog.tsx       # Integrated MediaSearchCombobox
components/items/file-type-combobox.tsx    # Minor styling updates
components/items/item-detail-client.tsx    # Hero banner improvements
components/items/item-hero.tsx             # Enhanced artwork handling
components/items/item-settings-dialog.tsx  # TMDB metadata lookup button
components/items/items-view.tsx            # Updated for new features
components/items/view-toggle.tsx           # Styling refinements
lib/google-drive-actions.ts                # Added uploadBuffer for poster uploads
lib/image-preload.ts                       # Image handling updates
lib/rate-limit.ts                          # Added tmdbSearch rate limit
lib/validations.ts                         # Description max length 200→1000
prisma/schema.prisma                       # Description field VARCHAR(1000)
e2e/pages/items.page.ts                    # Page object updates for TMDB
knip.json                                  # Ignore seed files from unused detection
package.json                               # Version bump, prisma seed script
```

## Technical Details

### TMDB client with graceful degradation

The TMDB client handles API failures without crashing. All API calls use timeouts and return null on error:

```typescript
async function tmdbFetch<T>(endpoint: string): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Circuit breaker for resilience

TMDB operations use the existing circuit breaker pattern to prevent cascade failures:

```typescript
const tmdbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  name: "tmdb-api",
});

// Usage
const results = await tmdbCircuitBreaker.execute(() => searchMedia(query));
```

### Rate limiting

TMDB search requests are rate-limited to prevent abuse:

```typescript
// In rate-limit.ts
tmdbSearch: { limit: 20, window: "1m" },
```

### Poster upload flow

When metadata is applied with poster artwork:

1. Download poster from TMDB (w500 size, ~50-100KB)
2. Upload to Google Drive via existing `uploadBuffer` action
3. Create or update ItemFile record with `isPrimary: true`
4. Revalidate paths for immediate UI update

```typescript
const posterBuffer = await downloadPoster(posterPath);
if (posterBuffer) {
  const uploadResult = await uploadBuffer(
    itemId,
    posterBuffer,
    "poster.jpg",
    "image/jpeg"
  );
  // Create ItemFile record...
}
```

## Test Results

| Suite      | Result     |
| ---------- | ---------- |
| Unit tests | 801 passed |
| Lint       | 0 errors   |
| Types      | 0 errors   |
| Knip       | 0 unused   |

New test coverage:

- 21 tests for TMDB actions
- 368 tests for TMDB client
- 376 tests for MediaSearchCombobox
- 450 tests for seed system
- 329 integration tests for metadata application
- E2E tests for media lookup flows

## Deployment Steps

1. Pull latest changes
2. Run `pnpm install` (no new dependencies)
3. Run migrations: `pnpm prisma migrate deploy`
4. Set `TMDB_API_KEY` environment variable (optional - features degrade gracefully without it)
5. Run `pnpm run check` to verify build
6. Deploy to Vercel

### New Environment Variables

| Variable       | Required | Description                                                                                      |
| -------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `TMDB_API_KEY` | Optional | TMDB v3 API key for metadata lookup. Without it, the search combobox shows manual input instead. |

### Seeding Variables (development only)

| Variable            | Default            | Description                             |
| ------------------- | ------------------ | --------------------------------------- |
| `ALLOW_SEEDING`     | `false`            | Must be `true` to run seed script       |
| `SEED_PASSWORD`     | `SeedPassword123!` | Password for seed users                 |
| `SEED_MAX_SEASONS`  | `2`                | Max seasons per TV show (0 = unlimited) |
| `SEED_MAX_EPISODES` | `10`               | Max episodes per season (0 = unlimited) |

## Version History

| Version | Date       | Summary                                       |
| ------- | ---------- | --------------------------------------------- |
| 2.0.0   | 2026-01-12 | TMDB metadata integration                     |
| 1.6.0   | 2026-01-11 | Spotlight search with artwork and breadcrumbs |
| 1.5.0   | 2026-01-11 | Dropzone upload for settings dialog           |
| 1.4.0   | 2026-01-11 | Google Drive improvements, sidebar cleanup    |
| 1.3.0   | 2026-01-10 | Dedicated password and email change modals    |
| 1.2.0   | 2026-01-10 | Sync behavior improvements, auth page polish  |
| 1.1.0   | 2026-01-10 | Test coverage expansion, auth UX improvements |
| 1.0.0   | 2026-01-10 | Google Drive integration replacing SFTP       |
