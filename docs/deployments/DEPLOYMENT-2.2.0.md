# Deployment 2.2.0 - Unified Modal System

**Date**: 2026-01-13
**Branch**: development

## Summary

Settings dialog now uses step-based navigation instead of nested modals. Click "Change Password" or "Change Email" and the dialog smoothly animates to show those fields inline, with a back button to return. This eliminates modal stacking issues and creates a cleaner user experience. The release also consolidates duplicated episode picker code into shared helpers and ensures consistent TMDB URL handling throughout.

## Features

### Step-based settings navigation

The settings dialog replaces nested modals with animated step transitions. When you click "Change Password" or "Change Email", the dialog content fades and slides to show the relevant form, then animates back when you're done or cancel.

**How it works:**

- Main settings view shows profile, email, password, and Google Drive sections
- Clicking "Change Password" or "Change Email" transitions to a dedicated step
- Back button and Cancel both return to the main view
- Success automatically returns to main with a toast notification

**AnimatedDialogContent component:**

```typescript
// Wraps dialog steps with crossfade + slide animation
<AnimatedDialogContent stepKey={currentStep}>
  {currentStep === "main" && <MainSettings />}
  {currentStep === "password" && <PasswordChange />}
  {currentStep === "email" && <EmailChange />}
</AnimatedDialogContent>
```

### Consolidated episode picker helpers

Extracted duplicated components from Add Item and Item Settings dialogs into a shared module. Both dialogs now import from the same source, ensuring consistent behavior and easier maintenance.

**Shared components in `episode-picker-helpers.tsx`:**

- `SeasonItem` - Renders season card with poster thumbnail
- `EpisodeItem` - Renders episode card with still image
- `LoadingState` - Spinner with customizable message
- `ErrorState` - Error display with icon and message

### Consistent TMDB URL handling

All TMDB image URLs now use validated helper functions instead of inline string construction. This ensures proper path validation and consistent size parameters.

**Before:**

```typescript
src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
```

**After:**

```typescript
src={getPosterUrl(result.posterPath, "w92") ?? undefined}
```

### Hero collapse hook

New `useHeroCollapse` hook manages hero section expand/collapse state with scroll-triggered behavior. Automatically collapses when scrolling down and expands when scrolling up.

### Artwork upload hook

New `useArtworkUpload` hook handles the complete artwork upload flow:

- File selection via dropzone
- Upload progress tracking
- Primary/hero flag management
- Error handling with toasts

## Files Changed

### Added

```
components/items/episode-picker-helpers.tsx     # Shared episode picker components
components/items/files-section.tsx              # File display section component
components/items/queued-file-thumbnail.tsx      # Thumbnail preview for queued files
components/ui/animated-dialog-content.tsx       # Animated step transitions
hooks/use-artwork-upload.ts                     # Artwork upload hook
hooks/use-hero-collapse.ts                      # Hero collapse behavior hook
e2e/journeys/items/item-hero.spec.ts            # Hero section E2E tests
scripts/generate-refresh-token.ts               # Google Drive token generator
tests/unit/components/items/hero-selection-step.test.tsx
tests/unit/components/items/poster-selection-step.test.tsx
tests/unit/components/ui/animated-dialog-content.test.tsx
tests/unit/hooks/use-hero-collapse.test.ts
docs/plans/2026-01-12-unified-modal-system.md
docs/plans/2026-01-13-add-item-summary-view.md
docs/plans/2026-01-13-artwork-loading-consistency.md
docs/plans/2026-01-13-wizard-my-uploads-tab-design.md
```

### Deleted

```
components/items/episode-picker.tsx             # Replaced by inline implementation
components/items/metadata-wizard-modal.tsx      # Wizard now inline in dialogs
components/profile/change-email-dialog.tsx      # Now step in settings dialog
components/profile/change-password-dialog.tsx   # Now step in settings dialog
tests/unit/components/change-email-dialog.test.tsx
tests/unit/components/change-password-dialog.test.tsx
tests/unit/components/items/episode-picker.test.tsx
tests/unit/components/items/metadata-wizard-modal.test.tsx
```

### Modified

```
components/items/add-item-dialog.tsx            # Import shared helpers
components/items/item-settings-dialog.tsx       # Import shared helpers
components/items/media-search-combobox.tsx      # Use TMDB URL helpers
components/profile/settings-dialog.tsx          # Step-based navigation
e2e/journeys/profile/settings.spec.ts           # Updated for step navigation
```

## Test Results

| Suite             | Result     |
| ----------------- | ---------- |
| Unit tests        | 964 passed |
| Integration tests | 82 passed  |
| E2E tests         | 356 passed |

## Migration Notes

### E2E test selectors

Tests targeting the settings dialog now use step-based selectors:

**Before:**

```typescript
// Nested modal approach
await page.getByRole("button", { name: /^change password$/i }).click();
```

**After:**

```typescript
// Step-based approach - target footer button specifically
await getProfileDialog(page)
  .locator('[data-slot="dialog-footer"]')
  .last()
  .getByRole("button", { name: /change password/i })
  .click();
```

The `.last()` handles animated transitions where both old and new content may briefly coexist.

### Import changes

If you were importing deleted components:

```typescript
// Old imports (no longer exist)
import { ChangeEmailDialog } from "@/components/profile/change-email-dialog";
import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { EpisodePicker } from "@/components/items/episode-picker";

// New approach: functionality is inline in SettingsDialog
// Episode picker helpers available as:
import {
  SeasonItem,
  EpisodeItem,
  LoadingState,
  ErrorState,
} from "@/components/items/episode-picker-helpers";
```
