# Auth Pages Redesign

## Overview

Modernize auth pages with shadcnblocks/login2 design, unify password inputs, and update branding assets including theme-aware logo and favicons.

## Goals

- Replace custom video-panel auth layout with clean login2 card design
- Create reusable `PasswordInput` component with Eye/EyeOff toggle
- Update sidebar logo to use theme-aware images
- Generate theme-aware favicons for light/dark system themes

## Prerequisites

- **ImageMagick** required for favicon generation: `brew install imagemagick`

## Design Decisions

### 1. Auth Page Layout

**Chosen:** Full login2 design (centered card, muted background)

**Rejected alternatives:**

- Keep video panel with login2 form - inconsistent with login2 aesthetic
- Card-only without background - less polished

**Implementation:**

- Use login2 as template for all four auth pages
- Add controlled form state, error handling, loading states
- Preserve existing `data-testid` attributes for E2E tests

### 2. Password Input Component

**Location:** `components/ui/password-input.tsx`

**Features:**

- Eye/EyeOff toggle button (based on settings dialog pattern)
- Same styling as standard Input (h-10, consistent spacing)
- Forwards all standard input props

**Usage:**

- All auth pages (sign-in, sign-up, reset-password)
- Settings dialog (replace inline implementation)

### 3. Sidebar Logo

**Approach:** Theme-aware using CSS

```tsx
<img src="/black.png" alt="CanonCore" className="h-8 w-auto dark:invert" />
```

- Uses `black.png` as base image (verified: RGBA with transparency)
- `dark:invert` flips to white on dark theme
- No JavaScript theme detection needed

### 4. Theme-Aware Favicons

**Light theme (from black.png):**

- `public/favicon.ico` (16x16, 32x32)
- `public/favicon-32x32.png`
- `public/apple-touch-icon.png` (180x180)

**Dark theme (from white.png):**

- `public/favicon-dark.ico`
- `public/favicon-dark-32x32.png`
- `public/apple-touch-icon-dark.png`

**Generation commands:**

```bash
# Light theme favicons (from black.png)
convert public/black.png -resize 32x32 -define icon:auto-resize=32,16 public/favicon.ico
convert public/black.png -resize 32x32 public/favicon-32x32.png
convert public/black.png -resize 180x180 public/apple-touch-icon.png

# Dark theme favicons (from white.png)
convert public/white.png -resize 32x32 -define icon:auto-resize=32,16 public/favicon-dark.ico
convert public/white.png -resize 32x32 public/favicon-dark-32x32.png
convert public/white.png -resize 180x180 public/apple-touch-icon-dark.png
```

**Metadata in `app/layout.tsx`:**

```tsx
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico", media: "(prefers-color-scheme: light)" },
      { url: "/favicon-dark.ico", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", media: "(prefers-color-scheme: light)" },
      {
        url: "/apple-touch-icon-dark.png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};
```

## Auth Page Specifications

| Page            | Fields                            | Extra Elements                                              |
| --------------- | --------------------------------- | ----------------------------------------------------------- |
| sign-in         | email, password                   | "Forgot password?" link                                     |
| sign-up         | email, password, confirm password | Password requirements hint, auto-sign-in on success         |
| forgot-password | email only                        | Success message state with "Back to sign in"                |
| reset-password  | new password, confirm password    | Token validation, Suspense wrapper, checkmark success state |

### Special Requirements

**reset-password page:**

- Must wrap in `<Suspense>` for `useSearchParams()` (Next.js requirement)
- Success state shows checkmark icon (✓) in green circle
- Token extracted from URL query params

## Data-Testid Preservation

All existing `data-testid` attributes must be preserved for E2E test compatibility:

**sign-in:**

- `sign-in-email-input`
- `sign-in-password-input`
- `sign-in-submit-button`
- `sign-in-error-message`
- `sign-in-forgot-password-link`
- `sign-in-sign-up-link`

**sign-up:**

- `sign-up-email-input`
- `sign-up-password-input`
- `sign-up-confirm-password-input`
- `sign-up-submit-button`
- `sign-up-error-message`
- `sign-up-sign-in-link`

**forgot-password:**

- `forgot-password-email-input`
- `forgot-password-submit-button`
- `forgot-password-error-message`
- `forgot-password-success-message`
- `forgot-password-back-to-sign-in-link`

**reset-password:**

- `reset-password-password-input`
- `reset-password-confirm-password-input`
- `reset-password-submit-button`
- `reset-password-error-message`
- `reset-password-success-message`
- `reset-password-sign-in-link`

## File Changes

### Create

| File                                               | Purpose                             |
| -------------------------------------------------- | ----------------------------------- |
| `components/ui/password-input.tsx`                 | Reusable password input with toggle |
| `public/favicon.ico`                               | Light theme favicon                 |
| `public/favicon-dark.ico`                          | Dark theme favicon                  |
| `public/favicon-32x32.png`                         | Light theme 32x32                   |
| `public/favicon-dark-32x32.png`                    | Dark theme 32x32                    |
| `public/apple-touch-icon.png`                      | Light theme apple icon              |
| `public/apple-touch-icon-dark.png`                 | Dark theme apple icon               |
| `tests/unit/components/ui/password-input.test.tsx` | Password input tests                |

### Modify

| File                                         | Change                                            |
| -------------------------------------------- | ------------------------------------------------- |
| `app/(auth)/sign-in/page.tsx`                | Use login2 layout + PasswordInput                 |
| `app/(auth)/sign-up/page.tsx`                | Use login2 layout + PasswordInput                 |
| `app/(auth)/forgot-password/page.tsx`        | Use login2 layout                                 |
| `app/(auth)/reset-password/page.tsx`         | Use login2 layout + PasswordInput + keep Suspense |
| `app/layout.tsx`                             | Add theme-aware favicon metadata                  |
| `components/app-sidebar.tsx`                 | Replace text with theme-aware image logo          |
| `components/profile/settings-dialog.tsx`     | Use PasswordInput component                       |
| `tests/unit/components/app-sidebar.test.tsx` | Update for image logo                             |

### Delete

| File                    | Reason                            |
| ----------------------- | --------------------------------- |
| `public/logo.png`       | Old alien logo                    |
| `public/auth-bg.mp4`    | Video panel removed               |
| `components/login2.tsx` | Template absorbed into auth pages |

## Testing

### E2E Tests

Existing Playwright tests use `data-testid` attributes which are preserved. Auth flows unchanged.

**Post-implementation:** Run full E2E suite to verify no regressions:

```bash
pnpm run test:e2e
```

### Unit Tests

**Update:**

- `tests/unit/components/app-sidebar.test.tsx` - expect image logo

**Add:**

- `tests/unit/components/ui/password-input.test.tsx` - test toggle visibility

### Integration Tests

No changes - auth logic unchanged.

## Implementation Steps

1. Create `PasswordInput` component and tests
2. Generate favicon sets using ImageMagick
3. Update `app/layout.tsx` with favicon metadata
4. Update `components/app-sidebar.tsx` with image logo
5. Refactor auth pages to login2 layout (one at a time):
   - sign-in
   - sign-up
   - forgot-password
   - reset-password (preserve Suspense wrapper)
6. Update settings dialog to use PasswordInput
7. Update app-sidebar unit tests
8. Delete old assets (logo.png, auth-bg.mp4, login2.tsx)
9. Run full test suite (`pnpm run check && pnpm run test:e2e`)
10. Manual visual verification in light and dark themes
