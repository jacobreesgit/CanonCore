# Public Profiles and Item Templates Design

## Overview

Add public user profiles and forkable item templates to CanonCore. Users can make their profile public, mark items as public, and others can discover and fork those items to their own library.

**Goals:**

- Discovery: Help users find others with similar interests
- Sharing: Show off curated collection structures

**Non-goals:**

- Collaboration: No shared editing (read-only public views)

## Data Model Changes

### User model additions

```prisma
model User {
  // ... existing fields ...

  username      String?   @unique   // lowercase, 3-20 chars, [a-z0-9_], nullable for migration
  isPublic      Boolean   @default(false)  // profile visible at /u/username

  // Relations for forks
  forks         Fork[]
}
```

**Migration notes:**

- `username` is nullable initially to support existing users
- Case-insensitive uniqueness enforced via raw SQL index (see Database Constraints)

### Item model additions

```prisma
model Item {
  // ... existing fields ...

  isPublic      Boolean   @default(false)  // visible on public profile
  tmdbId        Int?      // TMDB movie/TV ID for artwork re-fetch on fork
  tmdbType      String?   // "movie" | "tv"
  forkedFromId  String?   // original item ID if forked

  // Relations
  forkedFrom    Item?     @relation("ItemFork", fields: [forkedFromId], references: [id], onDelete: SetNull)
  forks         Item[]    @relation("ItemFork")
  sourceForks   Fork[]    @relation("ForkSource")
  targetForks   Fork[]    @relation("ForkTarget")

  // Indexes for public queries
  @@index([isPublic, updatedAt(sort: Desc)])  // Explore page sorting
  @@index([userId, isPublic])                  // User's public items
}
```

**Design decision - tmdbId/tmdbType storage:**

These fields persist TMDB references for re-fetching artwork during fork operations. They coexist with the existing transient `TMDBMetadataSelection` type (used for wizard UI state). Rationale:

- Persistent IDs enable data refresh without re-searching TMDB
- Supports cross-referencing with IMDB IDs in the future
- Follows [TMDB database schema best practices](https://github.com/transitive-bullshit/populate-movies)

**Design decision - no denormalized forkCount:**

Instead of a denormalized `forkCount` field (which risks data inconsistency), use Prisma's `_count` for on-demand calculation:

```typescript
// Get item with fork count
const item = await prisma.item.findUnique({
  where: { id: itemId },
  include: {
    _count: { select: { forks: true } },
  },
});
// Access via item._count.forks
```

For explore page sorting by popularity, use:

```typescript
const popularItems = await prisma.item.findMany({
  where: { isPublic: true },
  include: { _count: { select: { forks: true } } },
  orderBy: { forks: { _count: "desc" } },
});
```

### New Fork model

```prisma
model Fork {
  id            String   @id @default(cuid())
  sourceItemId  String   // original item
  targetItemId  String   // forked copy
  userId        String   // who forked
  createdAt     DateTime @default(now())

  sourceItem    Item     @relation("ForkSource", fields: [sourceItemId], references: [id], onDelete: Cascade)
  targetItem    Item     @relation("ForkTarget", fields: [targetItemId], references: [id], onDelete: Cascade)
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([sourceItemId, userId])  // one fork per user per item
  @@index([sourceItemId])
  @@index([userId])
}
```

**Cascade behavior:**

- When source item is deleted: Fork record deleted, target item remains (orphaned fork is still useful)
- When target item is deleted: Fork record deleted, source item unaffected
- When user is deleted: All their fork records deleted

## Routes & URL Structure

### New public routes

| Route                    | Description                               |
| ------------------------ | ----------------------------------------- |
| `/u/[username]`          | Public profile (hero + public items grid) |
| `/u/[username]/[itemId]` | Public item detail (drill-down)           |
| `/explore`               | Discover templates (search + sort)        |

### Auth page changes

| Route      | Change                      |
| ---------- | --------------------------- |
| `/sign-up` | Add required username field |

### Settings additions

| Location    | Change                                          |
| ----------- | ----------------------------------------------- |
| Profile tab | Add username edit, "Make profile public" toggle |

### API routes

| Route                     | Method | Description                               |
| ------------------------- | ------ | ----------------------------------------- |
| `/api/u/[username]`       | GET    | Public profile data                       |
| `/api/u/[username]/items` | GET    | Public items for a user (paginated)       |
| `/api/explore`            | GET    | Search/sort public items across all users |
| `/api/fork/[itemId]`      | POST   | Fork an item                              |
| `/api/username/check`     | GET    | Check username availability               |

### Route protection

- `/u/*` routes are publicly accessible (no auth required)
- Fork action requires authentication
- Private items return 404 even if URL is guessed
- Private profiles return 404 (indistinguishable from non-existent)

## Authorization Model

### Middleware-based protection

Create a reusable authorization helper for public routes:

```typescript
// lib/public-auth.ts

/**
 * Validates access to a public profile.
 * Returns user if public, null if private/non-existent.
 */
export async function getPublicUser(username: string): Promise<User | null> {
  const user = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      isPublic: true,
    },
  });
  return user;
}

/**
 * Validates access to a public item.
 * Checks full ancestor chain for privacy.
 */
export async function getPublicItem(
  itemId: string,
  username: string
): Promise<Item | null> {
  // First verify user is public
  const user = await getPublicUser(username);
  if (!user) return null;

  // Get item with ancestor chain
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      userId: user.id,
      isPublic: true,
    },
  });
  if (!item) return null;

  // Verify all ancestors are public (recursive CTE)
  const ancestorsPublic = await verifyAncestorChainPublic(item.id);
  return ancestorsPublic ? item : null;
}

/**
 * Recursive CTE to check ancestor chain privacy.
 */
async function verifyAncestorChainPublic(itemId: string): Promise<boolean> {
  const result = await prisma.$queryRaw<{ allPublic: boolean }[]>`
    WITH RECURSIVE ancestors AS (
      SELECT id, "parentId", "isPublic"
      FROM "Item"
      WHERE id = ${itemId}
      UNION ALL
      SELECT i.id, i."parentId", i."isPublic"
      FROM "Item" i
      INNER JOIN ancestors a ON i.id = a."parentId"
    )
    SELECT bool_and("isPublic") as "allPublic" FROM ancestors
  `;
  return result[0]?.allPublic ?? false;
}
```

### Page-level usage

```typescript
// app/(public)/u/[username]/page.tsx
export default async function PublicProfilePage({ params }) {
  const user = await getPublicUser(params.username);
  if (!user) notFound(); // 404 for private AND non-existent
  // ... render profile
}

// app/(public)/u/[username]/[itemId]/page.tsx
export default async function PublicItemPage({ params }) {
  const item = await getPublicItem(params.itemId, params.username);
  if (!item) notFound();
  // ... render item
}
```

## UI Components & Pages

### Sign-up page

- Add username field below email
- Real-time validation with 500ms debounce (availability check, format rules)
- Error messages: "Username taken" or "Only lowercase letters, numbers, underscores (3-20 chars)"
- Submit button disabled until username validated

**Username validation UX decision:**

Real-time debounced validation (500ms delay) provides better UX than submit-only validation:

- Immediate feedback reduces form abandonment
- Debouncing prevents excessive API calls
- [Industry best practice](https://dev.to/raffizulvian/beyond-the-keystrokes-solving-real-time-suggestions-with-debounce-k18) for search/availability checks

```typescript
// hooks/use-username-validation.ts
const debouncedCheck = useMemo(
  () =>
    debounce(async (username: string) => {
      if (!isValidUsernameFormat(username)) return;
      const available = await checkUsernameAvailability(username);
      setIsAvailable(available);
    }, 500),
  []
);
```

### Profile settings

- New "Username" field (editable, checks availability with debounce)
- New "Public profile" toggle with helper text: "Allow others to view your profile at /u/username"
- Warning when enabling: "Your public items will be visible to anyone"

### Item create/edit dialogs

- New "Visibility" toggle: Private (default) / Public
- Helper text: "Public items appear on your profile and can be forked"
- Warning when making parent public: "This will also make X child items public"
- Disabled toggle with tooltip when item has private ancestor: "Parent item must be public first"

### Public profile page (`/u/[username]`)

- Reuse `ItemHero` component (avatar as background if no hero, or hero image)
- Display name, username, "X public items", "Member since"
- Reuse `ItemsView` component (grid/tree toggle, sort options)
- Items show fork count badge if > 0 (using `_count`)
- "Fork" button on each item (authenticated users only)
- Pagination: 24 items per page with "Load more" button

### Explore page (`/explore`)

- Search bar at top with debounced search (300ms)
- Sort dropdown: Popular (fork count), Most Recent, Name A-Z, Name Z-A
- Grid of public items from all users
- Each card shows: item name, creator username (linked), fork count
- Click navigates to `/u/[username]/[itemId]`
- Pagination: 48 items per page with infinite scroll

### SEO and meta tags

Public pages need proper meta tags for sharing:

```typescript
// app/(public)/u/[username]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const user = await getPublicUser(params.username);
  if (!user) return {};

  return {
    title: `${user.name || user.username} | CanonCore`,
    description: `View ${user.name || user.username}'s public collection on CanonCore`,
    openGraph: {
      title: `${user.name || user.username}'s Collection`,
      description: `Browse public items from ${user.username}`,
      images: user.heroImage ? [`/api/user/${user.id}/hero`] : undefined,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}
```

## Fork Logic

### What gets copied

| Field                           | Copied? | Notes                      |
| ------------------------------- | ------- | -------------------------- |
| `name`                          | Yes     |                            |
| `description`                   | Yes     |                            |
| Item hierarchy                  | Yes     | Recursive tree copy        |
| `tmdbId`, `tmdbType`            | Yes     | For artwork re-fetch       |
| `isPublic`                      | No      | Forked items start private |
| `order`                         | Reset   | Start from 0               |
| `forkedFromId`                  | Set     | Points to original root    |
| Files (media/artwork/subtitles) | No      | User fetches own           |
| `driveFileId` references        | No      |                            |
| Playback progress               | No      |                            |
| `pinnedOrder`                   | No      |                            |

### Fork process

```typescript
// lib/fork-actions.ts
export async function forkItem(
  sourceItemId: string,
  destinationParentId: string | null,
  userId: string
): Promise<ItemResult<{ itemId: string }>> {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Verify source is public and accessible
      const source = await tx.item.findFirst({
        where: { id: sourceItemId, isPublic: true },
        include: { children: { where: { isPublic: true } } },
      });
      if (!source) throw new Error("Item not available");

      // 2. Check user hasn't already forked this item
      const existingFork = await tx.fork.findUnique({
        where: { sourceItemId_userId: { sourceItemId, userId } },
      });
      if (existingFork) throw new Error("Already forked");

      // 3. Copy item tree recursively (max depth 10)
      const newItem = await copyItemTree(
        tx,
        source,
        userId,
        destinationParentId,
        0
      );

      // 4. Create Fork record
      await tx.fork.create({
        data: { sourceItemId, targetItemId: newItem.id, userId },
      });

      // 5. Queue background job for TMDB artwork (if tmdbId exists)
      if (source.tmdbId) {
        await queueArtworkFetch({
          itemId: newItem.id,
          tmdbId: source.tmdbId,
          tmdbType: source.tmdbType,
          userId, // For Google Drive upload context
        });
      }

      return { success: true, data: { itemId: newItem.id } };
    },
    {
      timeout: 30000, // 30s timeout for deep trees
      isolationLevel: "ReadCommitted",
    }
  );
}

async function copyItemTree(
  tx: PrismaTransaction,
  source: ItemWithChildren,
  userId: string,
  parentId: string | null,
  depth: number
): Promise<Item> {
  if (depth > 10) throw new Error("Maximum nesting depth exceeded");

  const newItem = await tx.item.create({
    data: {
      name: source.name,
      description: source.description,
      tmdbId: source.tmdbId,
      tmdbType: source.tmdbType,
      forkedFromId: depth === 0 ? source.id : null, // Only root tracks source
      parentId,
      userId,
      order: 0,
      depth,
      isPublic: false, // Always private
    },
  });

  // Recursively copy children
  for (const child of source.children) {
    await copyItemTree(tx, child, userId, newItem.id, depth + 1);
  }

  return newItem;
}
```

### Background artwork job

```typescript
// lib/artwork-job.ts
interface ArtworkFetchJob {
  itemId: string;
  tmdbId: number;
  tmdbType: "movie" | "tv";
  userId: string; // Owner of the forked item
}

export async function processArtworkFetch(job: ArtworkFetchJob) {
  try {
    // 1. Fetch artwork URLs from TMDB
    const images = await getTMDBImages(job.tmdbId, job.tmdbType);
    if (!images.poster && !images.backdrop) return;

    // 2. Get user's Google Drive connection (if any)
    const driveConnection = await prisma.googleDriveConnection.findUnique({
      where: { userId: job.userId },
    });

    // 3. Download and upload to user's Drive (if connected)
    if (driveConnection) {
      if (images.poster) {
        await downloadAndUploadArtwork(
          images.poster,
          job.itemId,
          driveConnection,
          "poster"
        );
      }
      if (images.backdrop) {
        await downloadAndUploadArtwork(
          images.backdrop,
          job.itemId,
          driveConnection,
          "hero"
        );
      }
    }
  } catch (error) {
    // Log error but don't fail - user can manually add artwork later
    logger.error({ error, job }, "Failed to fetch TMDB artwork for fork");
  }
}
```

### Fork destination dialog

- "Where do you want to add this?"
- Show user's item tree (or "Root level")
- Confirm button: "Fork to [destination]"
- Loading state during fork operation

## Privacy Cascade Logic

### Making public

- Item becomes public
- All descendants become public (recursive)
- UI warning before confirm: "This will make [item] and X child items public"

### Making private

- Item becomes private
- All descendants become private (recursive)
- No warning needed (safe default)

### Server action

```typescript
async function setItemVisibility(
  itemId: string,
  isPublic: boolean,
  userId: string
): Promise<ItemResult> {
  // Verify ownership
  const item = await prisma.item.findFirst({
    where: { id: itemId, userId },
  });
  if (!item) return { error: "Item not found" };

  // If making public, verify parent is public (if exists)
  if (isPublic && item.parentId) {
    const parent = await prisma.item.findUnique({
      where: { id: item.parentId },
    });
    if (!parent?.isPublic) {
      return { error: "Parent item must be public first" };
    }
  }

  // Update item and all descendants in single transaction
  await prisma.$executeRaw`
    WITH RECURSIVE descendants AS (
      SELECT id FROM "Item" WHERE id = ${itemId}
      UNION ALL
      SELECT i.id FROM "Item" i
      INNER JOIN descendants d ON i."parentId" = d.id
    )
    UPDATE "Item" SET "isPublic" = ${isPublic}, "updatedAt" = NOW()
    WHERE id IN (SELECT id FROM descendants)
  `;

  return { success: true };
}
```

### Edge cases

| Case                      | Behavior                                            |
| ------------------------- | --------------------------------------------------- |
| Child of private parent   | Cannot make public; toggle disabled with tooltip    |
| Already forked items      | Making source private doesn't affect existing forks |
| URL guessing nested items | Check full ancestor chain; 404 if any private       |
| Moving public to private  | Item and descendants become private automatically   |

## Error Handling

### Username errors

| Error          | Message                                                     |
| -------------- | ----------------------------------------------------------- |
| Taken          | "Username already taken"                                    |
| Invalid format | "Only lowercase letters, numbers, underscores (3-20 chars)" |
| Reserved word  | "This username is not available"                            |

### Fork errors

| Error              | Handling                                         |
| ------------------ | ------------------------------------------------ |
| Not authenticated  | Redirect to sign-in, return to fork after        |
| Source now private | "This item is no longer available"               |
| Already forked     | "You've already forked this item" (link to copy) |
| Rate limited       | "Too many forks, try again later"                |
| Depth exceeded     | "This item is too deeply nested to fork"         |
| Timeout            | "Fork took too long. Please try a smaller item"  |

### Profile/item errors

| Error                    | Handling                     |
| ------------------------ | ---------------------------- |
| Username not found       | 404 page                     |
| Profile private          | 404 (don't reveal existence) |
| Item in private ancestor | 404                          |

### TMDB artwork fetch failures

- Log error, continue without artwork
- User can manually search TMDB later via item settings
- No user-facing error (graceful degradation)

## Rate Limits

| Action                      | Limit            |
| --------------------------- | ---------------- |
| Fork                        | 10/hour per user |
| Username availability check | 30/min per IP    |
| Explore search              | 60/min per IP    |
| Profile view                | 100/min per IP   |
| Public items list           | 60/min per IP    |
| Public item detail          | 120/min per IP   |

## Testing Strategy

### Unit tests (new)

- `tests/unit/lib/username-validation.test.ts` - format, length, allowed characters, reserved words
- `tests/unit/lib/visibility-cascade.test.ts` - cascade logic, parent constraints
- `tests/unit/lib/fork-item.test.ts` - copying logic (included/excluded fields), depth limit
- `tests/unit/lib/privacy-check.test.ts` - ancestor chain validation, edge cases
- `tests/unit/lib/public-auth.test.ts` - authorization helpers, 404 behavior

### Unit tests (modify)

- Sign-up form: add username field validation
- Item dialogs: add visibility toggle tests

### Integration tests (new)

- `tests/integration/profiles/public-profile.test.ts` - public profile queries, private returns null
- `tests/integration/fork/fork-item.test.ts` - fork creation, TMDB re-fetch job queuing
- `tests/integration/fork/fork-deletion.test.ts` - cascade behavior when source/target deleted
- `tests/integration/visibility/cascade.test.ts` - cascade updates, ancestor checks, race conditions

### Integration tests (modify)

- `tests/integration/auth/` - sign-up with username
- `tests/integration/items/` - visibility field in CRUD

### E2E tests (new)

- `e2e/journeys/profiles/public-profile.spec.ts` - view public profile, navigate items, 404 for private
- `e2e/journeys/profiles/fork-item.spec.ts` - fork flow, destination picker, success toast
- `e2e/journeys/explore/explore-page.spec.ts` - search, sort, pagination, navigation
- `e2e/journeys/auth/sign-up-username.spec.ts` - username validation, availability, debounce

### E2E tests (modify)

- `e2e/journeys/items/item-crud.spec.ts` - add visibility toggle tests
- `e2e/journeys/profile/settings.spec.ts` - username edit, public toggle

### E2E mobile tests (new)

- `e2e/journeys/explore/explore-page.spec.ts` - include `mobile-chrome` project
- `e2e/journeys/profiles/public-profile.spec.ts` - include `mobile-chrome` project

### Performance tests (consideration)

- Explore page: test with 10k+ public items for pagination performance
- Fork operation: test deep hierarchy (10 levels) fork timing
- Public profile: test with 100+ public items load time

### Accessibility tests

- Public profile: proper heading structure, keyboard navigation
- Explore page: screen reader announcements for search results
- Fork dialog: focus management, ARIA labels

## Database Constraints

### Case-insensitive username uniqueness

PostgreSQL unique index with lowercase function:

```sql
-- Migration: add_username_unique_index.sql
CREATE UNIQUE INDEX user_username_lower_idx ON "User" (LOWER(username))
WHERE username IS NOT NULL;
```

Note: Prisma `@unique` is case-sensitive by default. This raw SQL index ensures `JohnDoe` and `johndoe` are considered duplicates.

### Reserved username list

Enforced at application level in validation:

```typescript
// lib/validations.ts
export const RESERVED_USERNAMES = new Set([
  // Route conflicts
  "admin",
  "api",
  "explore",
  "settings",
  "u",
  "docs",
  "my-items",
  "sign-in",
  "sign-up",
  "forgot-password",
  "reset-password",
  // Common reserved
  "about",
  "privacy",
  "terms",
  "help",
  "support",
  "contact",
  "blog",
  "news",
  "status",
  // Brand protection
  "canoncore",
  "canon",
  "official",
  "staff",
  "team",
  // Offensive/misleading
  "null",
  "undefined",
  "anonymous",
  "system",
  "root",
]);

export function isUsernameReserved(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase());
}
```

### Fork unique constraint

Prevents duplicate forks per user per item:

```prisma
@@unique([sourceItemId, userId])
```

## Migration Notes

### Existing users

1. **Phase 1: Schema migration**
   - Add `username` as nullable field
   - Add `isPublic` with default `false`
   - No immediate impact on existing users

2. **Phase 2: Username prompt (non-blocking)**
   - Show banner on dashboard: "Set your username to enable your public profile"
   - Banner dismissible but reappears after 7 days
   - Users can continue using app without username

3. **Phase 3: Username required for public features**
   - Attempting to make profile/items public prompts username setup
   - Username required only when user wants public features

4. **Auto-generation option**
   - Suggest username based on email prefix (sanitized)
   - Example: `john.doe@email.com` → suggested: `johndoe`
   - User can accept or customize

### Existing items

- All existing items remain private by default (`isPublic: false`)
- No data migration needed for existing items
- `tmdbId`/`tmdbType` fields are nullable (populated on TMDB search)

### Rollback plan

- Username field nullable allows rollback without data loss
- Public routes can be disabled via feature flag
- Fork records can be deleted without affecting items

## Open Questions (Resolved)

### Q: Should tmdbId/tmdbType replace TMDBMetadataSelection?

**Decision:** Coexist. `TMDBMetadataSelection` is transient UI state for the wizard flow. The new persistent fields enable:

- Artwork re-fetch during fork without user re-searching
- Future data refresh capabilities
- Cross-referencing with other metadata sources

### Q: Real-time vs submit-only username validation?

**Decision:** Real-time with 500ms debounce. Industry best practice for better UX:

- Immediate feedback reduces abandonment
- Debouncing limits API calls to ~1 per second while typing
- Submit-only validation causes frustration when username taken

Sources:

- [Debouncing for Real-Time Suggestions](https://dev.to/raffizulvian/beyond-the-keystrokes-solving-real-time-suggestions-with-debounce-k18)
- [Debounce UX Best Practices](https://www.byteplus.com/en/topic/498848)
