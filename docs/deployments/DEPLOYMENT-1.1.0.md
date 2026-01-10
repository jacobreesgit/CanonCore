# Deployment 1.1.0 - Test Coverage and Auth UX

**Date**: 2026-01-10
**Branch**: development

## Summary

This release expands unit test coverage for API routes and media components, adds a password visibility toggle to auth forms, and introduces proper favicon support with light/dark mode variants.

## New Features

### Password Visibility Toggle

Auth forms now include a show/hide button for password fields:

| Feature            | Implementation                          |
| ------------------ | --------------------------------------- |
| Eye icon toggle    | Click to reveal password text           |
| Accessibility      | `aria-label` describes current state    |
| Reusable component | `components/ui/password-input.tsx`      |
| Applied to         | Sign in, Sign up, Forgot/Reset password |

### Favicon Support

Proper favicon configuration for all platforms:

| Asset                       | Purpose                          |
| --------------------------- | -------------------------------- |
| `favicon.ico`               | Standard browser favicon (light) |
| `favicon-dark.ico`          | Dark mode variant                |
| `favicon-32x32.png`         | High-res favicon                 |
| `apple-touch-icon.png`      | iOS home screen icon (light)     |
| `apple-touch-icon-dark.png` | iOS dark mode variant            |

## Test Coverage Expansion

Added 54 new unit tests covering previously untested areas:

| Test File                             | Tests  | Coverage                             |
| ------------------------------------- | ------ | ------------------------------------ |
| `stream-route.test.ts`                | 12     | Media streaming, Range headers       |
| `google-drive-callback-route.test.ts` | 11     | OAuth callback, CSRF protection      |
| `user-avatar-route.test.ts`           | 6      | Avatar image retrieval, ETag caching |
| `user-hero-route.test.ts`             | 6      | Hero banner retrieval, ETag caching  |
| `media-player.test.tsx`               | 10     | VideoPlayer props, callbacks         |
| `media-overlay.test.tsx`              | 9      | Overlay behavior, keyboard shortcuts |
| `password-input.test.tsx`             | varies | Toggle visibility, accessibility     |

**Total unit tests: 524** (up from 464 in v1.0.0)

## Files Changed

### Added

```
components/ui/password-input.tsx          # Password visibility toggle
tests/unit/api/stream-route.test.ts       # Stream API tests
tests/unit/api/google-drive-callback-route.test.ts
tests/unit/api/user-avatar-route.test.ts
tests/unit/api/user-hero-route.test.ts
tests/unit/components/media/media-player.test.tsx
tests/unit/components/media/media-overlay.test.tsx
tests/unit/components/ui/password-input.test.tsx
public/favicon.ico
public/favicon-dark.ico
public/favicon-32x32.png
public/favicon-dark-32x32.png
public/apple-touch-icon.png
public/apple-touch-icon-dark.png
docs/plans/2026-01-10-auth-redesign.md
docs/plans/2026-01-10-jsdoc-test-completeness-design.md
```

### Modified

```
app/(auth)/sign-in/page.tsx               # Use PasswordInput component
app/(auth)/sign-up/page.tsx               # Use PasswordInput component
app/(auth)/forgot-password/page.tsx       # Use PasswordInput component
app/(auth)/reset-password/page.tsx        # Use PasswordInput component
app/layout.tsx                            # Favicon metadata
```

### Deleted

```
public/auth-bg.mp4                        # Unused video background
public/logo.png                           # Replaced with favicons
```

## Test Results

| Suite      | Result     |
| ---------- | ---------- |
| Unit tests | 524 passed |
| Lint       | 0 errors   |
| Types      | 0 errors   |
| Build      | Success    |

## Deployment Steps

1. Pull latest changes
2. Run `pnpm install`
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No database migrations or environment variable changes required.

## Version History

| Version | Date       | Summary                                    |
| ------- | ---------- | ------------------------------------------ |
| 1.1.0   | 2026-01-10 | Test coverage expansion, auth UX, favicons |
| 1.0.0   | 2026-01-10 | Google Drive integration, SFTP removal     |
