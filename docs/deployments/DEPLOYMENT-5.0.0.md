# Deployment 5.0.0 - Unified Profile Routes and Hero Carousel

**Date**: 2026-01-22
**Branch**: development

## Summary

This major release unifies the `/my-items` and `/u/[username]` routes into a single canonical profile view at `/u/[username]`. Owners viewing their own profile see full editing capabilities, while other users see a read-only public view with fork options. The release also introduces a Hero226-based carousel system for featured content display, replacing the static ItemHero component and removing collapse/expand functionality for simpler UX.

## Breaking Changes

### Route Architecture

The `/my-items` route group has been deleted entirely:

```
BEFORE                              AFTER
/my-items                    →      /u/[username]
/my-items/[itemId]           →      /u/[username]/[itemId]
```

**Impact**: All internal links and bookmarks to `/my-items/*` will 404. Navigation automatically uses `/u/[username]` for authenticated users with a username set.

### Component Removals

| Component               | Replacement             | Reason                                      |
| ----------------------- | ----------------------- | ------------------------------------------- |
| `ItemHero`              | `HeroCarousel`          | Unified carousel for all hero displays      |
| `public-profile-client` | `UnifiedProfileClient`  | Single component handles owner/viewer modes |
| `nav-pinned-items`      | Integrated into NavMain | Simplified sidebar architecture             |
| `useHeroCollapse`       | Removed                 | Collapse functionality eliminated           |

## Features

### Unified Profile Route

The `/u/[username]` route now serves as the canonical view for any user's library:

```
Unified Profile Architecture:
┌─────────────────────────────────────────────────────────────┐
│ /u/[username]                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ Owner View (viewer === profile owner) ─────────────┐   │
│  │ • All items visible (public + private)               │   │
│  │ • Full CRUD operations                               │   │
│  │ • Edit mode with drag-drop                           │   │
│  │ • Settings dialogs                                   │   │
│  │ • Google Drive sync                                  │   │
│  │ • Progress tracking                                  │   │
│  │ • Play/Go-to buttons in hero                         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Viewer View (viewer !== profile owner) ─────────────┐   │
│  │ • Public items only                                  │   │
│  │ • Read-only display                                  │   │
│  │ • Fork button (authenticated) or sign-in prompt      │   │
│  │ • Owner attribution                                  │   │
│  │ • Sort options (no filter/edit)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key behavioral differences**:

| Feature           | Owner View | Viewer View | Guest View     |
| ----------------- | ---------- | ----------- | -------------- |
| Items shown       | All items  | Public only | Public only    |
| Edit mode         | Yes        | No          | No             |
| Add/Delete items  | Yes        | No          | No             |
| Drag-drop reorder | Yes        | No          | No             |
| Settings dialog   | Yes        | No          | No             |
| Google Drive sync | Yes        | No          | No             |
| Progress display  | Yes        | No          | No             |
| Fork button       | No         | Yes         | Sign in prompt |

### Hero Carousel System

Replaced static `ItemHero` with `HeroCarousel` based on Hero226 design:

```
Explore Page (Multi-Slide):
┌─────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Background Image]                                      │ │
│ │                                                         │ │
│ │ Breaking Bad                                            │ │
│ │ A chemistry teacher turned meth cook                    │ │
│ │                                                         │ │
│ │                              [View Collection →]        │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                    ● ○ ○ ○ ○  (Navigation Dots)            │
└─────────────────────────────────────────────────────────────┘

Item Detail Page (Single-Slide, Owner View):
┌─────────────────────────────────────────────────────────────┐
│ [Background Image]                                          │
│                                                             │
│ Breaking Bad                                                │
│ A chemistry teacher turned meth cook                        │
│                                                             │
│ ████████████░░░░░░░░░░░░  (Progress: 75%)                  │
│ 15/20 watched                                               │
│                                                             │
│ [▶ Resume S01E05]    [Go to S01E06 →]                      │
└─────────────────────────────────────────────────────────────┘
```

**Carousel features**:

| Feature                | Multi-Slide | Single-Slide | Notes                                     |
| ---------------------- | ----------- | ------------ | ----------------------------------------- |
| Autoplay               | Yes (4s)    | No           | Respects `prefers-reduced-motion`         |
| Navigation dots        | Yes         | No           | aria-current on active dot                |
| Play/Resume button     | No          | Owner only   | Requires `isOwner` + `hasMedia`           |
| Go-to button           | No          | Owner only   | Requires `isOwner` + `nextItem`           |
| Progress bar           | No          | Owner only   | Requires `isOwner` + `progressPercentage` |
| CTA button             | Yes         | Optional     | "View Collection" default                 |
| Image loading skeleton | Yes         | Yes          | Shows while background loads              |
| Shader1 fallback       | Yes         | Yes          | When no background image available        |

### Profile Hero Component

New `ProfileHero` component for profile pages with cover photos and avatars:

```typescript
interface ProfileHeroProps {
  profile: PublicProfile;
  isOwnProfile: boolean;
}
```

Displays user's hero banner image (if set) with avatar overlay and name/username.

### Auth Layout Redirect

New `(auth)/layout.tsx` redirects authenticated users away from auth pages:

```typescript
export default async function AuthLayout({ children }: AuthLayoutProps) {
  const session = await auth();
  if (session?.user) {
    redirect("/my-items"); // Soon to be /u/[username]
  }
  return children;
}
```

### Featured Items Server Action

New `getFeaturedItems()` for carousel:

```typescript
export const getFeaturedItems = cache(async (limit = 5): Promise<FeaturedItem[]>);
```

- Returns public items with artwork, ordered by most recently updated
- Uses `React.cache()` for request deduplication
- Graceful degradation (returns `[]` on error)
- Filters items with null artwork IDs or usernames

## Files Changed

### Added

```
app/(auth)/layout.tsx                           # Auth redirect guard
app/(auth)/forgot-password/forgot-password-form.tsx  # Extracted form component
app/(auth)/reset-password/reset-password-form.tsx    # Extracted form component
app/(auth)/sign-in/sign-in-form.tsx             # Extracted form component
app/(auth)/sign-up/sign-up-form.tsx             # Extracted form component
components/hero-carousel.tsx                    # Hero226-based carousel
components/profile/profile-hero.tsx             # Profile cover photo + avatar
components/profile/unified-profile-client.tsx   # Owner/viewer mode switching
components/ui/carousel.tsx                      # shadcn carousel component
docs/plans/2026-01-21-hero226-carousel-integration.md
docs/plans/2026-01-22-unified-profile-route.md
e2e/journeys/auth/auth-redirect.spec.ts         # Auth redirect E2E tests
tests/integration/public/get-featured-items.test.ts
tests/unit/components/hero-carousel.test.tsx
tests/unit/lib/get-featured-items.test.ts
types/next-auth.d.ts                            # NextAuth type declarations
```

### Deleted

```
app/(my-items)/layout.tsx                       # Route group removed
app/(my-items)/my-items/[itemId]/page.tsx       # Route group removed
app/(my-items)/my-items/page.tsx                # Route group removed
app/(public)/u/[username]/public-profile-client.tsx  # Replaced by unified
components/items/item-hero.tsx                  # Replaced by HeroCarousel
components/nav-pinned-items.tsx                 # Integrated into NavMain
hooks/use-hero-collapse.ts                      # Functionality removed
e2e/journeys/items/item-hero.spec.ts            # Tests for removed component
tests/unit/components/items/item-hero.test.tsx  # Tests for removed component
tests/unit/components/nav-pinned-items.test.tsx # Tests for removed component
tests/unit/hooks/use-hero-collapse.test.ts      # Tests for removed hook
```

### Modified (Key Files)

```
app/(public)/u/[username]/page.tsx              # Uses UnifiedProfileClient
app/(public)/u/[username]/[itemId]/page.tsx     # Uses HeroCarousel
app/(public)/u/[username]/[itemId]/public-item-client.tsx  # Updated imports
app/(public)/explore/page.tsx                   # Fetches featured items
app/(public)/explore/explore-client.tsx         # Uses HeroCarousel
components/app-sidebar.tsx                      # Passes username to NavMain
components/nav-main.tsx                         # /u/[username] URL handling
components/items/item-detail-client.tsx         # Uses HeroCarousel
components/items/items-view.tsx                 # Removed collapse logic
lib/public-auth.ts                              # getFeaturedItems, type updates
lib/types.ts                                    # FeaturedItem type
```

## Test Coverage Impact

| Area                       | Before | After | Change |
| -------------------------- | ------ | ----- | ------ |
| HeroCarousel tests         | 0      | ~35   | +35    |
| UnifiedProfileClient tests | 0      | ~20   | +20    |
| getFeaturedItems tests     | 0      | ~15   | +15    |
| Auth redirect E2E tests    | 0      | 5     | +5     |
| ItemHero tests (removed)   | ~25    | 0     | -25    |
| useHeroCollapse tests      | ~15    | 0     | -15    |
| nav-pinned-items tests     | ~10    | 0     | -10    |

**Net change**: +25 tests (more comprehensive coverage of new architecture)

## Migration Notes

1. **No database migration required** - no schema changes.

2. **URL updates needed** - Any hardcoded `/my-items` links in external documentation or user bookmarks will need updating to `/u/[username]`.

3. **Navigation automatic** - Authenticated users with a username are automatically directed to `/u/[username]` via the sidebar's My Items link.

4. **Username required** - The unified route requires users to have a username set. Users without usernames should be prompted to set one.

5. **Collapse state cleared** - Any localStorage keys related to hero collapse state (`hero-collapsed-*`) can be cleaned up but are harmless if left.

## Accessibility Improvements

- `aria-current="page"` on active navigation dots
- `aria-current="true"` on active sidebar menu items
- `prefers-reduced-motion` respected for all carousel animations
- Proper `role="tablist"` and `role="tab"` for dot navigation
- Keyboard navigation support for carousel dots

## Performance Notes

- `HeroCarousel` uses dynamic import for Autoplay plugin (only loaded for multi-slide)
- `getFeaturedItems` wrapped with `React.cache()` for request deduplication
- Image loading states prevent layout shift
- `content-visibility: auto` on off-screen grid items
