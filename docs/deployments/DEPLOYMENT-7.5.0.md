# Deployment 7.5.0

**Date**: 2026-02-13
**Type**: Minor (Google Drive reconnect banner)
**Migration Required**: No

## Overview

When a Google Drive connection expires or needs reauthentication, a persistent amber warning banner now appears across all pages — in the desktop header (below the breadcrumb row) and above the mobile footer navigation. The banner shows a "Reconnect" button that initiates the OAuth flow to restore the connection. All six route layouts fetch the Drive connection status server-side and pass `driveNeedsReauth` to both `SiteHeader` and `MobileNavProvider`.

13 files changed, 770 insertions, 16 deletions.

## New features

### Drive reconnect banner — desktop header

`components/site-header.tsx` — New `driveNeedsReauth` prop triggers an amber glass-styled banner below the breadcrumb row.

- Header layout changed from single-row (`items-center`) to `flex-col` to stack breadcrumb row + banner
- Banner uses `role="alert"` and `aria-live="assertive"` for screen reader announcement
- Amber `AlertTriangle` icon with warning text from `DRIVE_MESSAGES.DISCONNECTED_BANNER`
- "Reconnect" button calls `initiateGoogleDriveOAuth()` via `useTransition`
- Loading state: button text changes to "Connecting..." and becomes disabled
- Error handling: toast notification on OAuth failure
- Only visible on desktop (`lg:flex` on the header)

### Drive reconnect banner — mobile top

`components/mobile/mobile-nav-provider.tsx` — New `driveNeedsReauth` prop renders a fixed banner at the top of the viewport on mobile.

- Positioned `fixed inset-x-0 top-0` (floating above content)
- `lg:hidden` ensures it only shows on mobile viewports
- Same accessibility attributes: `role="alert"`, `aria-live="assertive"`
- Same styling as desktop (`gap-3`, `border-b`, glass background with `backdrop-blur-md`)
- 44px minimum touch target on the Reconnect button (`min-h-[44px]`)
- Same OAuth reconnect flow as desktop (shared `initiateGoogleDriveOAuth` action)

### Centralised Drive messages

`lib/constants/messages.ts` — New `DRIVE_MESSAGES` constant object:

- `DISCONNECTED_BANNER`: "Google Drive disconnected. Syncing and streaming are paused until you reconnect"

## Layout changes

All six route layouts updated to fetch Drive connection status and pass `driveNeedsReauth`:

| File | Change |
|---|---|
| `app/(public)/layout.tsx` | Extracts `driveNeedsReauth` from existing `driveConnection`, passes to `MobileNavProvider` |
| `app/(public)/page.tsx` | Converted to async server component, fetches `getGoogleDriveConnection()`, passes to `SiteHeader` |
| `app/(public)/explore/page.tsx` | Added `getGoogleDriveConnection()` to existing `Promise.all`, passes to `SiteHeader` |
| `app/(public)/u/[username]/page.tsx` | Extracts `driveNeedsReauth` from Drive connection, passes to `SiteHeader` |
| `app/(public)/u/[username]/[itemId]/page.tsx` | Owner path: extracts from existing connection. Viewer path: new `viewerDrivePromise` added to `Promise.all` |
| `app/(docs)/layout.tsx` | Added `getGoogleDriveConnection()` in `Promise.all`, passes to both `SiteHeader` and `MobileNavProvider` |

**Pattern**: All layouts use `driveConnection?.needsReauth ?? false` for null-safe extraction. Unauthenticated users always get `false` (no Drive connection to check).

## Test changes

### New unit tests

| Test file | Coverage |
|---|---|
| `tests/unit/components/drive-reconnect-banner.test.tsx` | 142 lines — desktop banner rendering, accessibility attributes, OAuth flow, loading state, error toast |
| `tests/unit/components/mobile-drive-reconnect-banner.test.tsx` | 198 lines — mobile banner rendering, accessibility, touch targets, OAuth flow, error toast, `lg:hidden` class |

### New E2E tests

| Test file | Coverage |
|---|---|
| `e2e/journeys/google-drive/drive-connection.spec.ts` | 200 lines added — `Google Drive: Reconnect Banner` describe block with 6 tests: banner visibility on token expiry, multi-page visibility, OAuth flow initiation, no banner when healthy, no banner when disconnected, banner disappears after reconnect |

E2E helpers:

- `setNeedsReauth(userId)` — creates/updates Drive connection with `needsReauth: true` via Prisma fixture
- `setHealthyConnection(userId)` — creates/updates healthy connection with future token expiry
- Uses `isMobileViewport(page)` to adapt assertions for desktop vs mobile test projects

### New stories

| Story file | Coverage |
|---|---|
| `components/site-header.stories.tsx` | 2 new stories: `DriveReconnectBanner` (banner visible with a11y assertions), `NoDriveReconnectBanner` (banner absent) |

### Updated stories

| Story file | Change |
|---|---|
| `components/site-header.stories.tsx` | Added `driveNeedsReauth` control to argTypes |

## Deployment notes

### No migration required

No schema changes. The `needsReauth` field on `GoogleDriveConnection` already exists.

### No environment variable changes

No new variables required.

### Verification

1. **Build passes**: `pnpm run build`
2. **Type check passes**: `pnpm run type-check`
3. **Unit tests pass**: `pnpm run test`
4. **E2E tests pass**: `pnpm run test:e2e`
5. **Desktop banner**: Set `needsReauth: true` on a Drive connection — amber banner appears below breadcrumbs in the header on all pages
6. **Mobile banner**: Same setup — banner appears above footer navigation on mobile
7. **Reconnect flow**: Click "Reconnect" — button shows "Connecting...", redirects to Google OAuth
8. **No banner when healthy**: With a valid Drive connection, no banner appears on any page
9. **No banner when disconnected**: Without a Drive connection at all, no banner appears
10. **Unauthenticated users**: Logged-out visitors see no banner
