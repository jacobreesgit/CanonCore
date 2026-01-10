# JSDoc and Test Completeness Design

**Date:** 2026-01-10
**Status:** Draft (Validated)
**Focus:** Completeness - ensuring all code follows standards

## 1. Scope & Goals

### Primary Goal

Complete JSDoc coverage across all custom components and comprehensive unit test coverage for untested modules.

### In Scope

- All files in `components/` (excluding `components/ui/*` shadcn components)
- All files in `app/api/` routes
- All files in `lib/`, `hooks/`, `contexts/`
- Unit tests for API routes and media components

### Out of Scope

- `components/ui/*` (shadcn/ui generated components)
- Third-party library types
- Test files themselves (JSDoc not required)

### Success Criteria

- Every exported function/component has JSDoc with `@param` and `@returns`
- API routes have unit test coverage
- Media components have unit test coverage
- `pnpm run check` passes
- All existing tests continue to pass

## 2. JSDoc Standard

### File Headers

Every file starts with a brief descriptive comment:

```typescript
/**
 * Brief description of what this file does.
 * Optional second line for additional context.
 */
```

### Function Documentation

Standard JSDoc with `@param`, `@returns`, and `@example` for complex functions:

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

### React Component Documentation

```typescript
/**
 * Brief description of what this component does.
 *
 * @param props - Component props
 * @param props.title - The title to display
 * @param props.onClose - Callback when component is closed
 */
export function MyComponent({ title, onClose }: MyComponentProps) {
  // ...
}
```

### Interface Documentation

```typescript
/**
 * Configuration for the media player.
 */
interface MediaPlayerProps {
  /** The source URL for the media file */
  src: string;
  /** Whether to autoplay on load */
  autoPlay?: boolean;
  /** Callback when playback ends */
  onEnded?: () => void;
}
```

### Guidelines

- **`@example`**: Include for complex utilities and server actions; skip for simple functions and React components
- **React props**: Document inline with TypeScript interface comments
- **Brevity**: One sentence descriptions preferred; expand only when logic is non-obvious

## 3. Test Additions

### API Route Unit Tests

#### `/api/stream/[fileId]/route.ts`

Currently untested. Add tests for:

- Valid file streaming with authentication
- Range header support (partial content)
- Unauthorized access rejection
- Invalid file ID handling
- MIME type detection

#### `/api/artwork/[fileId]/route.ts`

**Already tested** in `tests/unit/api/artwork-route.test.ts` with 6 tests covering:

- 401 when not authenticated
- 404 when file not found
- 403 when user doesn't own item
- 400 when file is not artwork type
- 404 when no storage connection
- 401 when Drive needs reauth

No additional tests needed for this route.

#### `/api/auth/callback/google-drive/route.ts`

Currently untested. Add tests for:

- Valid OAuth callback with state verification
- Token exchange success/failure
- Invalid/missing state parameter handling
- Error parameter handling from Google
- User session update after successful auth

#### `/api/user/avatar/route.ts` and `/api/user/hero/route.ts`

Currently untested. Add tests for:

- GET: Retrieve user image
- PUT: Upload new image
- DELETE: Remove image
- Size/format validation
- Authentication requirements

### Media Component Unit Tests

#### `components/media/media-player.tsx`

Add tests for:

- Renders video player with source
- Handles playback progress callbacks
- Forwards ref correctly
- Applies custom className

#### `components/media/media-overlay.tsx`

Add tests for:

- Opens/closes overlay correctly
- Tab navigation between files
- Keyboard shortcuts (Escape to close)
- Displays correct file based on selection

### Test Patterns

Follow existing patterns from `tests/unit/api/artwork-route.test.ts`:

```typescript
// API route test pattern (Next.js 16 with Promise params)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    itemFile: { findUnique: vi.fn() },
  },
}));

import { GET } from "@/app/api/stream/[fileId]/route";
import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

describe("GET /api/stream/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/stream/123");
    const response = await GET(request, {
      params: Promise.resolve({ fileId: "123" }),
    });

    expect(response.status).toBe(401);
  });
});
```

```typescript
// Component test pattern
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaPlayer } from "@/components/media/media-player";

describe("MediaPlayer", () => {
  it("renders with source URL", () => {
    render(<MediaPlayer src="/test-video.mp4" />);

    const player = screen.getByTestId("media-player");
    expect(player).toBeInTheDocument();
  });
});
```

## 4. Implementation Approach

### Phase 1: JSDoc Updates

1. Run audit to identify files missing JSDoc
2. Update files in batches by directory:
   - `components/google-drive/` (2 files)
   - `components/items/` (12 files)
   - `components/media/` (2 files)
   - `components/profile/` (1 file)
   - `components/sortable-grid/` (4 files)
   - `components/sortable-tree/` (4 files + 2 TreeItem files)
   - Root `components/` (11 files)
   - `components/providers/` (1 file)
3. Verify with `pnpm run type-check` after each batch

### Phase 2: API Route Tests

1. Use existing `tests/unit/api/` directory structure
2. Add tests for each route in priority order:
   - `stream/[fileId]` (most critical - media playback)
   - `auth/callback/google-drive` (OAuth security)
   - `user/avatar` and `user/hero` (profile features)
3. Follow existing mock patterns from `artwork-route.test.ts`

### Phase 3: Media Component Tests

1. Add tests to `tests/unit/components/media/`
2. Mock Vidstack player for media-player tests
3. Test overlay state management and keyboard handling

### Verification

After each phase:

- Run `pnpm run test:unit` - all tests pass
- Run `pnpm run check` - no type errors
- Run `pnpm run test:e2e` - no regressions

## Files to Update

### JSDoc Updates (36 files)

```
# Google Drive (2 files)
components/google-drive/oauth-toast.tsx
components/google-drive/settings-section.tsx

# Items (12 files)
components/items/add-item-dialog.tsx
components/items/edit-mode-toggle.tsx
components/items/file-type-combobox.tsx
components/items/item-context-menu.tsx
components/items/item-detail-client.tsx
components/items/item-hero.tsx
components/items/item-settings-dialog.tsx
components/items/item-stats.tsx
components/items/items-toolbar.tsx
components/items/items-view.tsx
components/items/sync-badge.tsx
components/items/view-toggle.tsx

# Media (2 files)
components/media/media-overlay.tsx
components/media/media-player.tsx

# Profile (1 file)
components/profile/settings-dialog.tsx

# Sortable Grid (4 files)
components/sortable-grid/Grid.tsx
components/sortable-grid/GridItem.tsx
components/sortable-grid/SortableGrid.tsx
components/sortable-grid/SortableGridItem.tsx

# Sortable Tree (4 files + 2 TreeItem)
components/sortable-tree/Tree.tsx
components/sortable-tree/SortableTree.tsx
components/sortable-tree/components/TreeItem/TreeItem.tsx
components/sortable-tree/components/TreeItem/SortableTreeItem.tsx

# Root components (11 files)
components/app-sidebar.tsx
components/error-boundary.tsx
components/my-items-providers.tsx
components/nav-docs.tsx
components/nav-main.tsx
components/nav-user.tsx
components/nav-guest.tsx
components/site-header.tsx
components/theme-toggle.tsx
components/shader1.tsx

# Providers (1 file)
components/providers/theme-provider.tsx
```

### New Test Files (5 files)

```
tests/unit/api/stream-route.test.ts
tests/unit/api/google-drive-callback-route.test.ts
tests/unit/api/user-avatar-route.test.ts
tests/unit/api/user-hero-route.test.ts
tests/unit/components/media/media-player.test.tsx
tests/unit/components/media/media-overlay.test.tsx
```

Note: `tests/unit/api/artwork-route.test.ts` already exists with comprehensive coverage.
