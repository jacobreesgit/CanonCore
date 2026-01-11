# Deployment 1.3.0 - Dedicated Password and Email Modals

**Date**: 2026-01-10
**Branch**: development

## Summary

Password and email changes now happen in dedicated modal dialogs instead of inline form fields. This improves focus, validation feedback, and security by requiring password confirmation for sensitive changes.

## Features

### Dedicated change password modal

Click **Change Password** in settings to open a focused dialog with:

- Current password field
- New password field with strength requirements
- Confirm password field with match validation
- Clear validation messages inline

The modal validates password strength (8+ characters, uppercase, lowercase, number) and confirms passwords match before submission.

### Dedicated change email modal

Click **Change Email** in settings to open a dialog with:

- New email field (pre-filled with current email)
- Current password field for verification
- Validation for email format and uniqueness

Email changes require password verification for security.

### Cleaner settings dialog

The main settings dialog now shows:

- Read-only email display with **Change Email** button
- **Change Password** button (no inline password fields)
- Profile picture, display name, and hero banner unchanged

## Files Changed

### Added

```
components/profile/change-password-dialog.tsx    # Password change modal
components/profile/change-email-dialog.tsx       # Email change modal
components/profile/index.ts                      # Barrel export for cleaner imports
tests/unit/components/change-password-dialog.test.tsx   # 11 unit tests
tests/unit/components/change-email-dialog.test.tsx      # 13 unit tests
tests/unit/components/settings-dialog.test.tsx          # 5 integration tests
docs/plans/2026-01-10-change-password-modal.md          # Design document
```

### Modified

```
components/profile/settings-dialog.tsx    # Removed inline fields, added modal buttons
components/nav-user.tsx                   # Updated import to use barrel export
e2e/journeys/profile/settings.spec.ts     # 17 E2E tests for modal flows
```

## Technical Details

### Component architecture

Both modal components follow the same pattern:

- `useCallback` for memoized handlers
- `useEffect` to reset form on dialog close
- Zod validation (passwordSchema, emailSchema)
- Sonner toast notifications for feedback
- Enter key support for form submission

### Barrel export

New `components/profile/index.ts` exports all profile components:

```typescript
export { SettingsDialog } from "./settings-dialog";
export { ChangePasswordDialog } from "./change-password-dialog";
export { ChangeEmailDialog } from "./change-email-dialog";
```

### Security considerations

- Password never stored in component props (passed at submit only)
- Form state cleared on dialog close
- Password fields use `type="password"` with toggle
- Email changes require password verification
- Server-side validation via existing `changePassword` and `updateProfile` actions

## Test Results

| Suite      | Result     |
| ---------- | ---------- |
| Unit tests | 553 passed |
| E2E tests  | 17 profile |
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

| Version | Date       | Summary                                       |
| ------- | ---------- | --------------------------------------------- |
| 1.3.0   | 2026-01-10 | Dedicated password and email change modals    |
| 1.2.0   | 2026-01-10 | Sync behavior improvements, auth page polish  |
| 1.1.0   | 2026-01-10 | Test coverage expansion, auth UX improvements |
| 1.0.0   | 2026-01-10 | Google Drive integration replacing SFTP       |
