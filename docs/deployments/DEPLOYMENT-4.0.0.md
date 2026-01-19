# Deployment 4.0.0 - Public Profiles and Forking

**Date**: 2026-01-18
**Branch**: development

## Summary

Users can now make their profile and items public. Public profiles are viewable at `/u/[username]`, and other users can fork public items into their own library. A new Explore page lets anyone browse public collections from the community.

## Features

### Public profiles with usernames

Users can enable a public profile in Settings:

**Profile settings:**

| Field      | Description                                          |
| ---------- | ---------------------------------------------------- |
| Username   | Unique handle (3-20 chars, alphanumeric + underscore) |
| Public     | Toggle to make profile discoverable                  |

**Username validation rules:**

- 3-20 characters
- Letters, numbers, and underscores only
- Cannot start with a number
- Case-insensitive uniqueness (e.g., "JohnDoe" blocks "johndoe")
- Real-time availability check as you type

### Item visibility controls

Items can be made public independently of the profile:

**Visibility toggle:**

- Available in item settings dialog
- Toggle switches between public/private state
- Items only appear publicly when profile is also public
- All ancestor items must be public for item to be viewable

**Public item URL:**

```
/u/[username]/[itemId]
```

### Forking public items

Users can copy public items to their own library:

**Fork behavior:**

| Aspect          | Behavior                                      |
| --------------- | --------------------------------------------- |
| What's copied   | Name, description, TMDB metadata              |
| What's not      | Files, child items, progress                  |
| Placement       | Choose root or any existing folder            |
| Attribution     | Shows "Forked from [name] by @username"       |
| Fork count      | Public items display their fork count         |

**Fork restrictions:**

- Cannot fork your own items
- Cannot fork the same item twice
- Item must be fully public (all ancestors public)
- Forked items start as private

### Fork destination dialog

When forking, users choose where to place the item:

**Dialog features:**

- Search/filter existing folders
- Virtualized list for large libraries (1000+ items)
- Shows folder hierarchy with depth indicators
- "My Items (Root)" option for top-level placement

### Explore page

A new browse page for discovering public content:

**Accessible at:** `/explore`

**Features:**

- Grid view of all public root-level items
- Shows item artwork with owner username
- Available to all users (authenticated and guests)
- Empty state encourages sharing content

### Sidebar navigation updates

The sidebar now includes an Explore link:

**Navigation by auth state:**

| User Type      | Navigation Items          |
| -------------- | ------------------------- |
| Authenticated  | My Items, Explore         |
| Guest          | Explore                   |

## Files Changed

### Added

```
app/(public)/explore/explore-client.tsx             # Explore page client component
app/(public)/explore/page.tsx                       # Explore page server component
app/(public)/u/[username]/page.tsx                  # Public profile page
app/(public)/u/[username]/public-profile-client.tsx # Profile client component
app/(public)/u/[username]/[itemId]/page.tsx         # Public item page
app/(public)/u/[username]/[itemId]/public-item-client.tsx # Item client component
app/api/fork/[itemId]/route.ts                      # Fork REST API
app/api/username/check/route.ts                     # Username availability API
components/items/fork-destination-dialog.tsx        # Folder picker for fork placement
components/items/visibility-toggle.tsx              # Public/private toggle switch
hooks/use-username-validation.ts                    # Username validation with debounce
lib/config/usernames.ts                             # Username validation constants
lib/fork-actions.ts                                 # Fork server actions
lib/public-auth.ts                                  # Public profile/item auth utilities
e2e/journeys/public/public-profile.spec.ts          # E2E tests for public features
e2e/pages/public-profile.page.ts                    # Page object for E2E tests
prisma/migrations/20260118190000_*/migration.sql    # Database migration
tests/unit/api/fork-route.test.ts                   # Fork API unit tests
tests/unit/api/username-check-route.test.ts         # Username API tests
tests/unit/hooks/use-username-validation.test.ts    # Validation hook tests
tests/unit/lib/fork-actions.test.ts                 # Fork actions tests
tests/unit/lib/public-auth.test.ts                  # Public auth tests
```

### Modified

```
app/(public)/layout.tsx                             # Public route group layout
components/app-sidebar.tsx                          # Added Explore nav for all users
components/items/item-hero.tsx                      # Fixed progress bar condition
components/nav-user.tsx                             # Added username display
components/profile/settings-dialog.tsx              # Added public profile tab
lib/auth-actions.ts                                 # Added setUsername action
lib/auth.ts                                         # Added username to session
lib/item-actions.ts                                 # Added visibility toggle action
lib/rate-limit.ts                                   # Added fork rate limit
lib/types.ts                                        # Added PublicProfile, ForkStatus types
lib/user-actions.ts                                 # Added profile visibility actions
lib/validations.ts                                  # Added username schema
prisma/schema.prisma                                # User, Item, Fork models
```

## Database Changes

### New columns on User

```sql
ALTER TABLE "User" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Case-insensitive unique index
CREATE UNIQUE INDEX "User_username_ci_key" ON "User" (LOWER("username")) WHERE "username" IS NOT NULL;
```

### New columns on Item

```sql
ALTER TABLE "Item" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Item" ADD COLUMN "forkedFromId" TEXT;
ALTER TABLE "Item" ADD COLUMN "tmdbId" INTEGER;
ALTER TABLE "Item" ADD COLUMN "tmdbType" TEXT;

-- Indexes for public queries
CREATE INDEX "Item_isPublic_updatedAt_idx" ON "Item"("isPublic", "updatedAt" DESC);
CREATE INDEX "Item_userId_isPublic_idx" ON "Item"("userId", "isPublic");
CREATE INDEX "Item_forkedFromId_idx" ON "Item"("forkedFromId");
```

### New Fork model

```sql
CREATE TABLE "Fork" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "targetItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fork_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Fork_sourceItemId_idx" ON "Fork"("sourceItemId");
CREATE INDEX "Fork_userId_idx" ON "Fork"("userId");
CREATE UNIQUE INDEX "Fork_sourceItemId_userId_key" ON "Fork"("sourceItemId", "userId");
```

## Test Results

| Suite       | Tests | Result     |
| ----------- | ----- | ---------- |
| Unit        | 1480+ | All passed |
| Integration | 102+  | All passed |
| E2E         | ~440  | All passed |

## API Changes

### New types

```typescript
// lib/types.ts

/** Public profile data for display */
export interface PublicProfile {
  id: string;
  username: string;
  name: string | null;
  hasAvatar: boolean;
  hasHeroImage: boolean;
}

/** Public item data (subset of full item) */
export interface PublicItem {
  id: string;
  name: string;
  description: string | null;
  artworkId: string | null;
  childCount: number;
}

// lib/fork-actions.ts

/** Fork operation result */
export interface ForkResult {
  itemId: string;
  name: string;
}

/** Fork relationship info */
export interface ForkInfo {
  source: { id: string; name: string; ownerUsername: string | null } | null;
  forkCount: number;
}

/** User's fork status for an item */
export interface ForkStatus {
  hasForked: boolean;
  forkedItemId: string | null;
}
```

### New server actions

```typescript
// lib/fork-actions.ts

/** Fork a public item into user's library */
export async function forkItem(
  sourceItemId: string,
  parentId?: string | null
): Promise<ItemResult<ForkResult>>;

/** Get fork status for current user */
export async function getForkStatus(itemId: string): Promise<ItemResult<ForkStatus>>;

/** Get fork info (source, count) for an item */
export async function getForkInfo(itemId: string): Promise<ItemResult<ForkInfo>>;

// lib/public-auth.ts

/** Get public profile by username */
export async function getPublicProfile(username: string): Promise<PublicProfile | null>;

/** Get public items for a user */
export async function getPublicItems(userId: string, parentId?: string | null): Promise<PublicItem[]>;

/** Check if item is fully public (all ancestors public) */
export async function isItemFullyPublic(itemId: string): Promise<boolean>;
```

### New API routes

```
GET  /api/fork/[itemId]     - Get fork status and info
POST /api/fork/[itemId]     - Create fork (body: { parentId?: string })
GET  /api/username/check    - Check availability (query: username)
```

### Rate limits

| Action    | Limit    |
| --------- | -------- |
| fork      | 10/min   |
| username  | 20/min   |

## Breaking Changes

None. All changes are additive and backwards compatible.

## Migration Notes

Run the database migration before deploying:

```bash
npx prisma migrate deploy
```

Existing users start with `isPublic: false` and no username. Existing items start with `isPublic: false`.
