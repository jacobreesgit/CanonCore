# Deployment 0.15.0 - Security Hardening and Code Quality

**Date**: 2026-01-03
**Branch**: development

## Summary

This release focuses on security hardening and code quality improvements identified during a comprehensive code review. Adds OWASP security headers, expands rate limiting to protect expensive operations, and fixes BigInt serialization for client-side file metadata.

## Changes

### Security Headers

Added comprehensive security headers to `next.config.mjs`:

- **Content Security Policy (CSP)**: Restricts resource loading to trusted sources
- **X-Frame-Options**: Prevents clickjacking by denying iframe embedding
- **X-Content-Type-Options**: Prevents MIME-type sniffing
- **X-XSS-Protection**: Enables browser XSS filtering
- **Referrer-Policy**: Controls referrer information leakage
- **Permissions-Policy**: Disables camera, microphone, and geolocation access

### Rate Limiting Expansion

Extended rate limiting from auth-only to cover SFTP and item operations:

| Operation    | Limit  | Purpose                         |
| ------------ | ------ | ------------------------------- |
| `sftpSync`   | 10/min | Prevents sync abuse (expensive) |
| `sftpTest`   | 20/min | Prevents connection test abuse  |
| `sftpCreate` | 10/min | Prevents connection spam        |
| `itemCreate` | 30/min | Normal user operations          |
| `itemUpdate` | 60/min | Normal user operations          |

### BigInt Serialization Fix

Fixed an issue where `ItemFile.size` (BigInt) couldn't be serialized to JSON for client components:

- Added `SerializedItemFile` type with `size: number | null`
- Added `serializeItemFile()` helper function
- Updated all components to use serialized version

### Code Quality

- Added explicit return type to `sendPasswordResetEmail`: `Promise<void>`
- Added explicit return type to `logSecurityEvent`: `Promise<void>`
- Improved JSDoc comments in `lib/crypto.ts`
- Updated test setup to mock rate limiting properly

## Files Changed

```
lib/
├── auth-actions.ts      # Added return type to logSecurityEvent
├── crypto.ts            # Improved JSDoc documentation
├── email.ts             # Added Promise<void> return type
├── item-actions.ts      # Added rate limit checks
├── item-file-actions.ts # Serialize BigInt before returning
├── rate-limit.ts        # Added SFTP and item rate limiters
├── sftp-actions.ts      # Added rate limit checks
└── types.ts             # Added SerializedItemFile type

next.config.mjs          # Added security headers

components/
├── items/
│   ├── item-detail.tsx           # Use SerializedItemFile
│   ├── item-settings-dialog.tsx  # Use SerializedItemFile
│   └── items-view.tsx            # Use SerializedItemFile
└── media/
    ├── media-overlay.tsx         # Use SerializedItemFile
    └── media-player.tsx          # Use SerializedItemFile

tests/
├── unit/setup.ts        # Mock checkRateLimit
└── integration/setup.ts # Set BYPASS_RATE_LIMIT=true
```

## Test Results

- **Unit tests**: 192 passed
- **Integration tests**: 43 passed
- **E2E tests**: 92 passed (chromium)

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install` (no new dependencies)
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

## Rollback

If issues occur, revert to v0.14.0. No database migrations in this release.
