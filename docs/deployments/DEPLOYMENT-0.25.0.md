# Deployment 0.25.0 - ItemHero and Profile Settings

**Date**: 2026-01-07
**Branch**: development

## Summary

This release introduces hero banners throughout the app and profile settings for user customization. Item detail pages now display cinematic hero sections with artwork backgrounds, and users can personalize their experience with custom avatars and hero images.

## Changes

### ItemHero Component

New hero banner component displayed on item detail pages:

| Feature             | Description                                         |
| ------------------- | --------------------------------------------------- |
| Artwork background  | Full-width hero with gradient overlay               |
| Title & description | Item name and optional description overlay          |
| File counts         | Media, artwork, subtitle counts displayed as badges |
| Play button         | Primary action for items with media files           |
| Continue Watching   | Badge shown when media has playback progress        |

The hero replaces the previous tabbed media/folders view with a cleaner single-page layout.

### Profile Settings Dialog

New profile customization accessible from user dropdown:

| Setting    | Details                                           |
| ---------- | ------------------------------------------------- |
| Avatar     | 1MB max, JPEG/PNG/WebP, displayed in sidebar      |
| Hero image | 2MB max, same formats, displayed on My Items root |
| Name       | Display name shown in user dropdown               |

Images are stored directly in the database as Base64 with MIME type tracking.

### User Image API Routes

Two new authenticated endpoints for serving user images:

- `GET /api/user/avatar` - Serves user avatar with ETag caching
- `GET /api/user/hero` - Serves user hero image with ETag caching

Both routes use MD5-based ETags and 1-hour cache headers.

### isHero Field for ItemFile

New database field for hero artwork selection:

- `isHero` boolean field separate from `isPrimary`
- Allows different artwork for hero display vs file list
- Fallback chain: isHero -> isPrimary -> first artwork

### Architecture Changes

**ItemDetailClient simplified:**

- Removed tabbed files/folders view
- Always displays: Toolbar -> Hero -> Children
- MediaOverlay opens inline when Play clicked

**FilteredItemsView enhanced:**

- Accepts `heroTitle` and `hasHeroImage` props
- Passes hero configuration to ItemsView

**NavUser updated:**

- Opens ProfileSettingsDialog on click
- Displays user avatar when set

## Files Changed

```
# New components
components/items/item-hero.tsx              # Hero banner component
components/profile/profile-settings-dialog.tsx  # Profile settings modal
components/shader1.tsx                      # Visual effect component

# New API routes
app/api/user/avatar/route.ts               # Avatar image endpoint
app/api/user/hero/route.ts                 # Hero image endpoint

# New server actions
lib/user-actions.ts                        # getProfile, updateProfile, updateAvatar, updateHeroImage

# Deleted components
components/items/item-detail.tsx           # Replaced by ItemHero + MediaOverlay

# Modified components
components/items/item-detail-client.tsx    # Hero-first layout
components/items/filtered-items-view.tsx   # Hero props support
components/items/items-view.tsx            # Hero banner integration
components/items/items-toolbar.tsx         # Simplified
components/nav-user.tsx                    # Profile dialog integration

# Database migrations
prisma/migrations/20260106185632_add_is_hero_to_item_file/
prisma/migrations/20260106193402_add_user_image_fields/

# New tests
tests/unit/components/items/item-hero.test.tsx     # 192 lines
tests/unit/lib/user-actions.test.ts                # 652 lines
tests/integration/user/profile.test.ts             # 324 lines
e2e/journeys/profile/settings.spec.ts              # 164 lines
```

## Test Results

- **Unit tests**: 463 passed
- **Integration tests**: 65 passed
- **E2E tests**: Running on deployment

### New E2E Tests

Profile Settings tests:

1. `should open profile settings from user dropdown`
2. `should update display name`
3. `should upload and display avatar`
4. `should upload and display hero image`
5. `should show validation errors for oversized images`

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install`
3. Run `npx prisma migrate deploy` (new migrations)
4. Run `pnpm run check` to verify build
5. Deploy to Vercel

No new environment variables required.

## Database Migrations

Two new migrations add:

```sql
-- ItemFile.isHero field
ALTER TABLE "ItemFile" ADD COLUMN "isHero" BOOLEAN NOT NULL DEFAULT false;

-- User image fields
ALTER TABLE "User" ADD COLUMN "image" BYTEA;
ALTER TABLE "User" ADD COLUMN "imageMime" TEXT;
ALTER TABLE "User" ADD COLUMN "heroImage" BYTEA;
ALTER TABLE "User" ADD COLUMN "heroImageMime" TEXT;
```

## Architecture Notes

### Hero Artwork Resolution

The ItemDetailClient resolves hero artwork using a single-pass algorithm:

```
for each artwork file:
  if isHero: return immediately (highest priority)
  if isPrimary and no primaryFile yet: save as fallback
return heroFile ?? primaryFile ?? firstFile ?? null
```

### Image Storage Strategy

User images stored as database BLOBs rather than filesystem:

- Simplifies deployment (no file storage configuration)
- Enables caching via ETag headers
- Trade-off: Slightly larger database size
