# Deployment 7.4.0

**Date**: 2026-02-13
**Type**: Minor (mobile swipeable tabs, Embla Carousel migration)
**Migration Required**: No

## Overview

Mobile item detail pages now have swipeable tabs (Contents/About) with native-feeling touch gestures via Embla Carousel. A new `SwipeableUnderlineTabs` component provides the cinematic underline tab bar with horizontal swipe navigation between content panels. The existing `SwipeableTabs` component (used in bottom sheets) migrated from Framer Motion to Embla Carousel for consistent behaviour and better touch performance. E2E test stability improved with explicit page reloads for RSC revalidation and strict mode locator fixes.

12 files changed, 1,338 insertions, 199 deletions.

## New features

### SwipeableUnderlineTabs — swipeable tabs for item detail pages

`components/ui/swipeable-underline-tabs.tsx` — Embla Carousel-based swipeable tab component with the same cinematic underline visual style as `UnderlineTabs`, adding horizontal swipe navigation between content panels.

- Embla Carousel handles touch/drag gestures with native-feeling physics
- Adjacent tab content slides in during swipe (peek effect)
- Sliding indicator uses CSS `translate` (no Motion dependency)
- `isDraggingRef` pattern separates swipe-initiated vs programmatic tab changes
- `swipeEnabled` prop disables swipe during edit mode (drag-and-drop conflicts)
- `inert` and `aria-hidden` on inactive panels for proper accessibility
- Full WCAG 2.1 Level A: `tablist`/`tab`/`tabpanel` roles, arrow key navigation, Home/End, `aria-live` announcements
- Loaded via `next/dynamic` to keep Embla out of the desktop bundle

### Mobile item detail swipe navigation

Both private and public item detail pages now render `SwipeableUnderlineTabs` on mobile instead of static `UnderlineTabs`:

| File | Change |
|---|---|
| `components/items/item-detail-client.tsx` | Mobile uses `SwipeableUnderlineTabs` with controlled `activeTab` state |
| `app/(public)/u/[username]/[itemId]/public-item-detail-client.tsx` | Same swipeable tabs treatment for public item pages |

**Hydration guard**: Both pages use a `tabsMounted` state that flips to `true` after mount, preventing a hydration mismatch from the SSR `UnderlineTabs` swapping to `SwipeableUnderlineTabs` on the client.

**Active tab sync**: Controlled `activeTab` state synced with `defaultTabId` via `useEffect`, so the tab switches automatically when children are added or removed.

## Component changes

### SwipeableTabs — Framer Motion to Embla Carousel migration

`components/mobile/swipeable-tabs.tsx` — Replaced Framer Motion (`AnimatePresence`, drag gestures, spring animations) with Embla Carousel for consistent behaviour across all swipeable tab instances.

**Removed**:

- `motion.div` with `AnimatePresence` and `popLayout` mode
- `drag="x"` with `dragConstraints` and `dragElastic`
- `handleDragEnd` with `SWIPE_THRESHOLD` / `VELOCITY_THRESHOLD` constants
- `SPRING_CONFIG` animation config
- `direction` state for exit animation direction

**Added**:

- Embla Carousel (`useEmblaCarousel`) with `containScroll: false`
- `inert` and `aria-hidden` on inactive tab panels (accessibility improvement)
- CSS `translate` sliding indicator (replaces `motion.div`)
- `tabIndex` only on active panel (was `tabIndex={0}` on all panels)

**Behaviour differences**:

- Adjacent panel content now peeks during swipe (Embla carousel slide), replacing the opacity-based exit/enter from Motion
- Tab changes flow through Embla's `select` event rather than manual swipe threshold detection
- `prefers-reduced-motion` now disables drag entirely (`watchDrag: false`) rather than using `duration: 0` animations

## E2E test changes

### Test stability improvements

| File | Change |
|---|---|
| `e2e/journeys/items/items-settings.spec.ts` | Added `page.reload()` before re-checking persisted data — RSC revalidation is async, so re-opening settings without reload could show stale server state |
| `e2e/pages/items.page.ts` | Fixed strict mode violation — `mobile-options-trigger` now uses `.first()` because `SwipeableUnderlineTabs` renders both tab panels in the DOM (Embla carousel), each with its own `ContentToolbar` trigger |
| `e2e/journeys/public/explore.spec.ts` | Formatting cleanup (collapsed multi-line `dispatchEvent` chains) |

### Comment updates

References to `AnimatePresence` tab animation replaced with Embla Carousel references in `items-settings.spec.ts` wait comments.

## Test changes

### New unit tests

| Test file | Coverage |
|---|---|
| `tests/unit/components/ui/swipeable-underline-tabs.test.tsx` | 438 lines — rendering, tab switching, keyboard navigation, swipe sync, `inert`/`aria-hidden`, screen reader announcements, `swipeEnabled` prop, reduced motion |

### Updated unit tests

| Test file | Change |
|---|---|
| `tests/unit/components/mobile/swipeable-tabs.test.tsx` | Expanded for Embla Carousel — updated `inert`/`aria-hidden` assertions, removed Motion-specific mocks |
| `tests/unit/components/items/item-settings-dialog.test.tsx` | Minor mock updates for current component shape |

### New stories

| Story file | Coverage |
|---|---|
| `components/ui/swipeable-underline-tabs.stories.tsx` | 231 lines — default, three tabs, `swipeEnabled` disabled, reduced motion, custom styling |

### Updated stories

| Story file | Change |
|---|---|
| `components/mobile/swipeable-tabs.stories.tsx` | Updated description and feature list for Embla Carousel |

## Deployment notes

### No migration required

No schema changes, no new database fields.

### No environment variable changes

No new variables required.

### Verification

1. **Build passes**: `pnpm run build`
2. **Type check passes**: `pnpm run type-check`
3. **Unit tests pass**: `pnpm run test`
4. **E2E tests pass**: `pnpm run test:e2e`
5. **Mobile swipe navigation**: Open an item with children on mobile — swipe between Contents and About tabs
6. **Public item swipe**: Visit a public item detail page on mobile — same swipe behaviour
7. **Edit mode disables swipe**: Enter edit mode on Contents tab — swipe should be disabled
8. **Bottom sheet tabs**: Open item settings on mobile — SwipeableTabs in sheet uses Embla (not Motion)
9. **Desktop unchanged**: Item detail pages on desktop still use static `UnderlineTabs` (no Embla loaded)
10. **Reduced motion**: Enable reduced motion — transitions should be instant, drag disabled
