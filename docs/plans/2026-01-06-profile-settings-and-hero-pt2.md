# Profile Settings & My Items Hero - Part 2

**Date:** 2026-01-06
**Status:** Approved (Validated)
**Related:** [Hero Image & Settings Save Redesign (Part 1)](./2026-01-06-hero-image-and-settings-save.md)

## Overview

User profile management and My Items page hero customization:

1. **Profile Settings Dialog** - Edit name, email, password, and profile picture
2. **My Items Hero Image** - Customizable banner for the My Items root page
3. **Image Storage** - Binary blob storage in PostgreSQL

## Data Model

### User model changes

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  emailVerified   DateTime?
  passwordHash    String
  name            String?

  // Profile image - binary storage
  image           Bytes?    // Profile picture (max 1MB)
  imageMime       String?   // MIME type (image/jpeg, image/png, etc.)

  // Hero banner - binary storage (NEW)
  heroImage       Bytes?    // Hero banner image (max 2MB)
  heroImageMime   String?   // MIME type for hero

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  passwordResets  PasswordReset[]
  items           Item[]
  sftpConnections SftpConnection[]
}
```

### Image Storage Approach

- **Binary blob (Bytes)** stored directly in PostgreSQL
- **Prisma v6**: Use `Uint8Array` (not `Buffer`) for Bytes fields
- **MIME type** stored alongside for proper Content-Type headers
- **Size limits**: Profile 1MB, Hero 2MB (validated server-side)
- **Served via API routes** with caching headers

### Migration Note

The existing `image` field changes from `String?` to `Bytes?`. Based on codebase review, this field is currently unused (NavUser shows hardcoded fallback). Migration is safe but should explicitly handle any edge cases.

## Profile Settings Dialog

### Access Point

Add "Profile Settings" menu item to NavUser dropdown (between user info and "Log out").

### Dialog Layout

```
┌─────────────────────────────────────────┐
│ 👤 Profile Settings                      │
│ Manage your account                      │
├─────────────────────────────────────────┤
│ ┌───────┐                               │
│ │ [pic] │  Display Name                 │
│ │       │  [Jacob Rees            ]     │
│ └───────┘  [Change Photo] [Remove]      │
│                                         │
│ Email (requires password to change)     │
│ [jacob@example.com                   ]  │
│                                         │
│ ─────────────────────────────────────   │
│                                         │
│ Hero Banner                             │
│ ┌─────────────────────────────────────┐ │
│ │  [hero preview - wide format]       │ │
│ └─────────────────────────────────────┘ │
│ [Upload Banner] [Remove]                │
│                                         │
│ ─────────────────────────────────────   │
│                                         │
│ Change Password                         │
│ Current Password [••••••••          ]   │
│ New Password     [                  ]   │
│ Confirm          [                  ]   │
│                                         │
├─────────────────────────────────────────┤
│              [Cancel]  [Save Changes]   │
└─────────────────────────────────────────┘
```

### Behavior

- **Single Save button** saves all changes atomically (consistent with Item Settings pt.1)
- **Cancel** closes dialog without saving
- **Dirty state tracking** - Save disabled until changes made
- **Image preview** - Show preview after file selection, before save
- **Password section** - Optional; only validated/saved if any password field filled
- **Email change** - Requires current password re-entry for security

### State Management

```typescript
interface ProfileChanges {
  name?: string;
  email?: string;
  profileImage?: File | null; // null = remove
  heroImage?: File | null; // null = remove
  currentPassword?: string; // Required for email OR password change
  newPassword?: string;
  confirmPassword?: string;
}
```

## API Routes

### Image Serving Routes

```
GET /api/user/avatar
```

- **Authorization**: Gets userId from session (not URL param) - prevents enumeration
- Returns authenticated user's profile image as binary response
- Headers:
  - `Content-Type: {imageMime}`
  - `Cache-Control: public, max-age=3600`
  - `ETag: {hash}` for conditional requests
- Returns 404 if no image set

```
GET /api/user/hero
```

- **Authorization**: Gets userId from session (not URL param)
- Returns authenticated user's hero banner image
- Same headers and caching as avatar
- Returns 404 if no hero set

### Implementation Note

Routes must get userId from authenticated session, NOT from URL parameters. This prevents user enumeration attacks where an attacker could iterate through user IDs to discover which exist.

```typescript
// CORRECT approach
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, imageMime: true },
  });
  // ...
}
```

## Server Actions

### New: `lib/user-actions.ts`

```typescript
/**
 * Update user profile (name and/or email).
 * Email changes require current password for security.
 */
export async function updateProfile(data: {
  name?: string;
  email?: string;
  currentPassword?: string; // Required if email is being changed
}): Promise<ActionResult<void>>;

/**
 * Change user password.
 * Requires current password for verification.
 * Invalidates all other sessions after successful change.
 */
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult<void>>;

/**
 * Upload profile image.
 * Validates file content (magic bytes), type, and size.
 */
export async function uploadProfileImage(
  formData: FormData
): Promise<ActionResult<void>>;

/**
 * Upload hero banner image.
 * Validates file content (magic bytes), type, and size.
 */
export async function uploadHeroImage(
  formData: FormData
): Promise<ActionResult<void>>;

/**
 * Remove profile image.
 */
export async function removeProfileImage(): Promise<ActionResult<void>>;

/**
 * Remove hero image.
 */
export async function removeHeroImage(): Promise<ActionResult<void>>;

/**
 * Atomic update for profile settings dialog.
 * Handles all changes in a single transaction.
 */
export async function updateProfileSettings(data: {
  name?: string;
  email?: string;
  profileImage?: { data: Uint8Array; mimeType: string } | null;
  heroImage?: { data: Uint8Array; mimeType: string } | null;
  password?: { current: string; new: string };
}): Promise<ActionResult<void>>;
```

### Implementation Requirements

1. **Authorization**: All actions verify authenticated user via session

2. **Email Change Security**:
   - Require current password re-entry when changing email
   - Prevents session hijacker from locking out real user
   - Log email change event for audit trail

3. **File Upload Validation** (Magic Byte Verification):

   ```typescript
   import { fileTypeFromBuffer } from "file-type";

   const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

   async function validateImage(buffer: Uint8Array, maxSize: number) {
     // Check size
     if (buffer.length > maxSize) {
       throw new Error("File too large");
     }

     // Validate actual content (not just MIME header)
     const type = await fileTypeFromBuffer(buffer);
     if (!type || !ALLOWED_TYPES.includes(type.mime)) {
       throw new Error("Invalid image format");
     }

     return type.mime;
   }
   ```

4. **EXIF Stripping** (Privacy):
   - Strip EXIF metadata from uploaded images
   - Removes GPS coordinates, device info, timestamps
   - Use library like `sharp` or `exif-remove`

5. **Password Security**:
   - Validate strength (8+ chars, uppercase, lowercase, number)
   - Hash with bcryptjs (cost factor 12)
   - Invalidate other sessions after password change
   - Rate limit: 5 attempts per hour

6. **Atomicity**: `updateProfileSettings` uses Prisma transaction

7. **Audit Logging**: Log sensitive changes (password, email) with timestamp and IP

## Component Changes

### NavUser

Add "Profile Settings" dropdown item:

```typescript
<DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
  <Settings />
  Profile Settings
</DropdownMenuItem>
```

### ItemHero

Update ItemHero to support both item artwork URLs and user hero URLs, with shader fallback:

**Props changes:**

```typescript
interface ItemHeroProps {
  name: string;
  description?: string | null;

  // Background image options (use one or the other)
  artworkId?: string | null; // Item artwork via /api/artwork/{id}
  backgroundUrl?: string | null; // Direct URL (e.g., /api/user/hero)

  // ... existing props unchanged
  hasMedia?: boolean;
  hasProgress?: boolean;
  mediaCount?: number;
  artworkCount?: number;
  subtitleCount?: number;
  childCount?: number;
  onPlay?: () => void;
  className?: string;
}
```

Display priority: `backgroundUrl` → `artworkId` → shader fallback

**Implementation changes:**

```typescript
// Determine background source
const backgroundSrc = backgroundUrl
  ?? (artworkId ? `/api/artwork/${artworkId}` : null);
const shouldShowBackground = backgroundSrc && !imageError;

// Replace gradient fallback with Shader1
{!shouldShowBackground && (
  <div data-testid="hero-fallback" className="absolute inset-0 z-0">
    <Shader1 />
  </div>
)}
```

### Shader Fallback Component

Install the shadcnblocks shader component:

```bash
npx shadcn add @shadcnblocks/shader1
```

This provides an animated WebGL gradient background instead of the current static gradient. Used when:

- **My Items page**: No user hero image uploaded
- **Item detail page**: No artwork files attached to item

The shader creates visual interest even without uploaded images, making the UI feel more polished.

### FilteredItemsView / ItemsView

Pass user hero URL to ItemHero on root My Items page:

```typescript
<ItemHero
  name={heroTitle ?? "My Items"}
  backgroundUrl="/api/user/hero"
  childCount={items.length}
/>
```

### New: ProfileSettingsDialog

New component at `components/profile/profile-settings-dialog.tsx`:

- Form sections for name, email, images, password
- File input with preview for images
- Current password field (required for email/password changes)
- Validation feedback with specific error messages
- Single Save button with loading state
- Cancel button resets to original values

## Test Changes

### Unit Tests - Add

| File                               | Tests                                                      |
| ---------------------------------- | ---------------------------------------------------------- |
| `user-actions.test.ts`             | `updateProfile` updates name                               |
| `user-actions.test.ts`             | `updateProfile` updates email with password                |
| `user-actions.test.ts`             | `updateProfile` rejects email change without password      |
| `user-actions.test.ts`             | `updateProfile` validates email format                     |
| `user-actions.test.ts`             | `updateProfile` checks email uniqueness                    |
| `user-actions.test.ts`             | `changePassword` validates current password                |
| `user-actions.test.ts`             | `changePassword` enforces password strength                |
| `user-actions.test.ts`             | `changePassword` hashes new password                       |
| `user-actions.test.ts`             | `changePassword` invalidates other sessions                |
| `user-actions.test.ts`             | `uploadProfileImage` validates magic bytes (not just MIME) |
| `user-actions.test.ts`             | `uploadProfileImage` rejects spoofed MIME type             |
| `user-actions.test.ts`             | `uploadProfileImage` validates file size                   |
| `user-actions.test.ts`             | `uploadProfileImage` strips EXIF metadata                  |
| `user-actions.test.ts`             | `uploadHeroImage` validates magic bytes                    |
| `user-actions.test.ts`             | `uploadHeroImage` validates file size                      |
| `user-actions.test.ts`             | `updateProfileSettings` transaction rollback               |
| `user-actions.test.ts`             | Rate limiting on password changes                          |
| `profile-settings-dialog.test.tsx` | Renders all form sections                                  |
| `profile-settings-dialog.test.tsx` | Single Save button saves all changes                       |
| `profile-settings-dialog.test.tsx` | Cancel closes without saving                               |
| `profile-settings-dialog.test.tsx` | Image upload shows preview                                 |
| `profile-settings-dialog.test.tsx` | Password validation (matching, strength)                   |
| `profile-settings-dialog.test.tsx` | Email change requires password field                       |
| `profile-settings-dialog.test.tsx` | Dirty state enables/disables Save                          |
| `profile-settings-dialog.test.tsx` | Concurrent edit handling                                   |
| `item-hero.test.tsx`               | `backgroundUrl` displays as background                     |
| `item-hero.test.tsx`               | `backgroundUrl` takes precedence over `artworkId`          |
| `item-hero.test.tsx`               | `artworkId` displays as background when no backgroundUrl   |
| `item-hero.test.tsx`               | Shader1 fallback renders when no background                |
| `item-hero.test.tsx`               | Shader1 renders on image load error                        |
| `nav-user.test.tsx`                | Profile Settings menu item opens dialog                    |

### Integration Tests - Add

| File                   | Tests                                     |
| ---------------------- | ----------------------------------------- |
| `user/profile.test.ts` | Update name persists to database          |
| `user/profile.test.ts` | Update email persists and is unique       |
| `user/profile.test.ts` | Update email requires correct password    |
| `user/profile.test.ts` | Email uniqueness conflict returns error   |
| `user/profile.test.ts` | Password change updates hash              |
| `user/profile.test.ts` | Password change requires correct current  |
| `user/profile.test.ts` | Password change rate limiting enforced    |
| `user/profile.test.ts` | Image upload stores binary and MIME       |
| `user/profile.test.ts` | Image with wrong magic bytes rejected     |
| `user/profile.test.ts` | Large file rejected at validation         |
| `user/profile.test.ts` | Image removal clears fields               |
| `user/profile.test.ts` | Atomic update rolls back on failure       |
| `user/profile.test.ts` | API routes return correct caching headers |

### E2E Tests - Add

| File                       | Tests                                      |
| -------------------------- | ------------------------------------------ |
| `profile/settings.spec.ts` | Open dialog from user dropdown             |
| `profile/settings.spec.ts` | Update display name and verify in sidebar  |
| `profile/settings.spec.ts` | Update email with password and verify      |
| `profile/settings.spec.ts` | Email change without password shows error  |
| `profile/settings.spec.ts` | Change password and re-login               |
| `profile/settings.spec.ts` | Password change logs out other sessions    |
| `profile/settings.spec.ts` | Upload profile image and verify avatar     |
| `profile/settings.spec.ts` | Upload hero image, verify on My Items page |
| `profile/settings.spec.ts` | Upload malformed image shows error         |
| `profile/settings.spec.ts` | Remove images and verify shader fallback   |
| `profile/settings.spec.ts` | Email already exists shows error           |
| `items/items-crud.spec.ts` | Item without artwork shows shader fallback |

## Seed Data

### Unsplash Images for Seed Users

Download and store Unsplash images as bytes for seed user profiles (sized near max limits):

| Image Purpose | Unsplash URL                                                                | Target Size |
| ------------- | --------------------------------------------------------------------------- | ----------- |
| Profile Pic   | `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1200&q=100` | ~1MB        |
| Hero Banner   | `https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2400&q=100` | ~2MB        |

### Seed Implementation

Add to `prisma/seed.ts`:

```typescript
/**
 * Fetch image from URL and return as Uint8Array with MIME type.
 */
async function fetchImageAsBytes(
  url: string
): Promise<{ data: Uint8Array; mime: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();

  return {
    data: new Uint8Array(arrayBuffer),
    mime: contentType,
  };
}

// In seed function:
const UNSPLASH_PROFILE =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1200&q=100";
const UNSPLASH_HERO =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2400&q=100";

// Fetch images (only for primary seed user)
const [profileImage, heroImage] = await Promise.all([
  fetchImageAsBytes(UNSPLASH_PROFILE),
  fetchImageAsBytes(UNSPLASH_HERO),
]);

// Create seed user with images
await prisma.user.upsert({
  where: { email: "seed@canoncore.com" },
  update: {},
  create: {
    email: "seed@canoncore.com",
    name: "Seed User",
    passwordHash: await hash(SEED_PASSWORD, 12),
    image: profileImage.data,
    imageMime: profileImage.mime,
    heroImage: heroImage.data,
    heroImageMime: heroImage.mime,
  },
});
```

### Seed User Image Assignment

| User                | Profile Pic | Hero Banner | Rationale                    |
| ------------------- | ----------- | ----------- | ---------------------------- |
| seed@canoncore.com  | ✓           | ✓           | Full demo with all features  |
| seed2@canoncore.com | ✓           | ✗           | Partial data (shader hero)   |
| seed3@canoncore.com | ✗           | ✗           | Empty account (both shaders) |

## Migration

```sql
-- Add image storage fields to User
-- Note: Existing image field is unused, safe to change type
ALTER TABLE "User"
  ALTER COLUMN "image" TYPE BYTEA USING NULL,
  ADD COLUMN "imageMime" TEXT,
  ADD COLUMN "heroImage" BYTEA,
  ADD COLUMN "heroImageMime" TEXT;
```

## Files to Create

- `lib/user-actions.ts` - Profile server actions
- `components/profile/profile-settings-dialog.tsx` - Settings dialog
- `app/api/user/avatar/route.ts` - Avatar image endpoint
- `app/api/user/hero/route.ts` - Hero image endpoint
- `tests/unit/lib/user-actions.test.ts`
- `tests/unit/components/profile/profile-settings-dialog.test.tsx`
- `tests/integration/user/profile.test.ts`
- `e2e/journeys/profile/settings.spec.ts`

## Files to Modify

- `prisma/schema.prisma` - User model changes (image fields)
- `prisma/seed.ts` - Add Unsplash image fetching for seed users
- `components/nav-user.tsx` - Add Profile Settings menu item
- `components/items/item-hero.tsx` - Add `backgroundUrl` prop, replace gradient with Shader1 fallback
- `components/items/filtered-items-view.tsx` - Pass `/api/user/hero` URL
- `components/items/items-view.tsx` - Accept and pass hero URL prop
- `components/items/item-detail-client.tsx` - Continue using `artworkId` (unchanged)
- `tests/unit/components/items/item-hero.test.tsx` - Add `backgroundUrl` and Shader1 tests
- `tests/unit/components/nav-user.test.tsx` - Add menu item test

## Dependencies to Add

### Shader Fallback (install first)

```bash
npx shadcn add @shadcnblocks/shader1
```

- `@shadcnblocks/shader1` - Animated WebGL gradient background for hero fallback
- Used on both **My Items page** (no user hero) and **Item detail pages** (no artwork)

### Image Processing

```json
{
  "file-type": "^19.0.0",
  "sharp": "^0.33.0"
}
```

- `file-type` - Magic byte validation for uploaded files
- `sharp` - Image processing (EXIF stripping, optional resizing)

## Security Considerations

- **Password changes** require current password verification
- **Email changes** require current password (prevents session hijacking lockout)
- **Session invalidation** after password change (all other sessions)
- **Rate limiting**: 5 password change attempts per hour
- **File validation**: Magic byte verification (not just MIME headers)
- **EXIF stripping**: Remove metadata from uploads (GPS, device info)
- **API authorization**: Routes get userId from session, not URL params
- **Audit logging**: Log password/email changes with timestamp and IP
- **No PII exposure**: Avatar/hero endpoints only return images, not user data

## Future Considerations

- **Email verification** for email changes (add emailPending field)
- **Image optimization** - resize/compress on upload with sharp
- **CDN caching** - if image serving becomes a bottleneck
- **Two-factor authentication** - require 2FA for sensitive changes
