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

  username      String    @unique   // lowercase, 3-20 chars, [a-z0-9_]
  isPublic      Boolean   @default(false)  // profile visible at /u/username
}
```

### Item model additions

```prisma
model Item {
  // ... existing fields ...

  isPublic      Boolean   @default(false)  // visible on public profile
  tmdbId        Int?      // TMDB movie/TV ID for artwork re-fetch on fork
  tmdbType      String?   // "movie" | "tv"
  forkedFromId  String?   // original item ID if forked
  forkCount     Int       @default(0)  // denormalized for sort performance
}
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
| `/api/u/[username]/items` | GET    | Public items for a user                   |
| `/api/explore`            | GET    | Search/sort public items across all users |
| `/api/fork/[itemId]`      | POST   | Fork an item                              |

### Route protection

- `/u/*` routes are publicly accessible (no auth required)
- Fork action requires authentication
- Private items return 404 even if URL is guessed

## UI Components & Pages

### Sign-up page

- Add username field below email
- Real-time validation (availability check, format rules)
- Error messages: "Username taken" or "Only lowercase letters, numbers, underscores (3-20 chars)"

### Profile settings

- New "Username" field (editable, checks availability)
- New "Public profile" toggle with helper text: "Allow others to view your profile at /u/username"

### Item create/edit dialogs

- New "Visibility" toggle: Private (default) / Public
- Helper text: "Public items appear on your profile and can be forked"
- Warning when making parent public: "This will also make X child items public"

### Public profile page (`/u/[username]`)

- Reuse `ItemHero` component (avatar as background if no hero, or hero image)
- Display name, username, "X public items", "Member since"
- Reuse `ItemsView` component (grid/tree toggle, sort options)
- Items show fork count badge if > 0
- "Fork" button on each item (authenticated users only)

### Explore page (`/explore`)

- Search bar at top
- Sort dropdown: Popular, Most Recent, Name A-Z, Name Z-A
- Grid of public items from all users
- Each card shows: item name, creator username, fork count
- Click navigates to `/u/[username]/[itemId]`

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
| `forkedFromId`                  | Set     | Points to original         |
| Files (media/artwork/subtitles) | No      | User fetches own           |
| `driveFileId` references        | No      |                            |
| Playback progress               | No      |                            |
| `pinnedOrder`                   | No      |                            |

### Fork process

1. Copy item tree recursively with above rules
2. Increment `forkCount` on source item
3. Create `Fork` record linking source to target
4. Queue background job to fetch TMDB artwork (if `tmdbId` exists)
5. Upload artwork to user's Google Drive (if connected)

### Fork destination dialog

- "Where do you want to add this?"
- Show user's item tree (or "Root level")
- Confirm button: "Fork to [destination]"

## Privacy Cascade Logic

### Making public

- Item becomes public
- All descendants become public (recursive)
- UI warning before confirm: "This will make [item] and X child items public"

### Making private

- Item becomes private
- All descendants become private (recursive)
- No warning needed (safe default)

### Edge cases

| Case                      | Behavior                                            |
| ------------------------- | --------------------------------------------------- |
| Child of private parent   | Cannot make public; toggle disabled with tooltip    |
| Already forked items      | Making source private doesn't affect existing forks |
| URL guessing nested items | Check full ancestor chain; 404 if any private       |

### Server action

```typescript
async function setItemVisibility(itemId: string, isPublic: boolean) {
  // Update item and all descendants in single transaction
  // Uses recursive CTE similar to progress calculation
}
```

## Error Handling

### Username errors

| Error          | Message                                                     |
| -------------- | ----------------------------------------------------------- |
| Taken          | "Username already taken"                                    |
| Invalid format | "Only lowercase letters, numbers, underscores (3-20 chars)" |
| Reserved word  | Block `admin`, `api`, `explore`, `settings`, `u`, etc.      |

### Fork errors

| Error              | Handling                                         |
| ------------------ | ------------------------------------------------ |
| Not authenticated  | Redirect to sign-in, return to fork after        |
| Source now private | "This item is no longer available"               |
| Already forked     | "You've already forked this item" (link to copy) |
| Rate limited       | "Too many forks, try again later"                |

### Profile/item errors

| Error                    | Handling                     |
| ------------------------ | ---------------------------- |
| Username not found       | 404 page                     |
| Profile private          | 404 (don't reveal existence) |
| Item in private ancestor | 404                          |

### TMDB artwork fetch failures

- Log error, continue without artwork
- User can manually search TMDB later via item settings

### Rate limits

| Action                      | Limit            |
| --------------------------- | ---------------- |
| Fork                        | 10/hour per user |
| Username availability check | 30/min per IP    |
| Explore search              | 60/min per IP    |

## Testing Strategy

### Unit tests (new)

- `tests/unit/lib/username-validation.test.ts` - format, length, allowed characters
- `tests/unit/lib/visibility-cascade.test.ts` - cascade logic
- `tests/unit/lib/fork-item.test.ts` - copying logic (included/excluded fields)
- `tests/unit/lib/privacy-check.test.ts` - ancestor chain validation

### Unit tests (modify)

- Sign-up form: add username field validation
- Item dialogs: add visibility toggle tests

### Integration tests (new)

- `tests/integration/profiles/public-profile.test.ts` - public profile queries
- `tests/integration/fork/fork-item.test.ts` - fork creation with TMDB re-fetch
- `tests/integration/visibility/cascade.test.ts` - cascade updates, ancestor checks

### Integration tests (modify)

- `tests/integration/auth/` - sign-up with username
- `tests/integration/items/` - visibility field in CRUD

### E2E tests (new)

- `e2e/journeys/profiles/public-profile.spec.ts` - view public profile, navigate items
- `e2e/journeys/profiles/fork-item.spec.ts` - fork flow, destination picker
- `e2e/journeys/explore/explore-page.spec.ts` - search, sort, navigation
- `e2e/journeys/auth/sign-up-username.spec.ts` - username validation, availability

### E2E tests (modify)

- `e2e/journeys/items/item-crud.spec.ts` - add visibility toggle tests
- `e2e/journeys/profile/settings.spec.ts` - username edit, public toggle

## Database Constraints

- Username unique index (case-insensitive via `LOWER(username)`)
- Fork unique constraint prevents duplicate forks per user
- Reserved username list enforced at application level

## Migration Notes

- Existing users will need to set username (prompt on next login)
- All existing items remain private by default
- No data migration needed for existing items
