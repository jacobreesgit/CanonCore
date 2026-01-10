# Direct-to-Google-Drive Upload Design

**Date:** 2026-01-09
**Status:** Reviewed

## Overview

Replace server-proxied uploads with direct browser-to-Google-Drive uploads, removing file size limits and reducing bandwidth costs. Integrate upload functionality into file type comboboxes within the Item Settings dialog.

## Problem

Current upload flow:

```
Browser → Server Action (FormData) → Google Drive API
```

**Limitations:**

- Next.js Server Actions: 1MB default body limit
- Vercel free tier: 4.5MB hard limit (platform constraint)
- Files pass through server = bandwidth cost on Vercel

## Solution

New upload flow:

```
1. Browser requests upload session(s) from Server
2. Server creates resumable upload URL(s) via Google Drive API
3. Browser uploads directly to Google Drive using those URLs
4. Browser notifies Server to create ItemFile records
```

**Benefits:**

- No file size limits (bypasses Vercel's 4.5MB limit)
- No bandwidth cost on server (files go directly to Google)
- Faster uploads (one less hop)
- Can handle 100MB+ video files

## Requirements

Based on design discussion:

- **File types:** Mixed (images + large media files)
- **Progress feedback:** Essential - show real progress bar
- **Batch upload:** Yes - multiple files per upload
- **Partial failure handling:** Continue all, offer retry for failed
- **File size limit:** None (let Google Drive be the constraint)
- **Upload location:** Integrated into Item Settings dialog comboboxes
- **No upload modal:** Progress shown inline in comboboxes

## Architecture

### Server Actions

**New actions in `lib/google-drive-actions.ts`:**

```typescript
/**
 * Creates upload sessions for multiple files.
 * Returns resumable upload URLs from Google Drive.
 *
 * IMPORTANT: Origin is required for CORS - Google Drive resumable uploads
 * only allow browser requests from the origin specified at session creation.
 */
export async function createUploadSessions(
  itemId: string,
  files: Array<{ name: string; mimeType: string }>,
  origin: string // Client origin for CORS (e.g., "https://canoncore.com")
): Promise<{
  success: boolean;
  sessions?: Array<{
    fileName: string;
    uploadUrl: string; // Resumable upload URL from Google (CORS-enabled for origin)
    sessionToken: string; // Signed JWT containing session data
  }>;
  error?: string;
}>;

/**
 * Confirms upload completed and creates ItemFile record.
 * Validates JWT signature and creates database record.
 */
export async function confirmUpload(
  sessionToken: string, // JWT from createUploadSessions
  driveFileId: string
): Promise<{
  success: boolean;
  itemFile?: { id: string; filename: string; fileType: string };
  error?: string;
}>;
```

**Session management via JWT tokens (serverless-compatible):**

- No server-side storage required - works with Vercel serverless
- JWT payload: `{ itemId, userId, fileName, mimeType, parentDriveId, fileType, exp }`
- Signed with `AUTH_SECRET` (same as NextAuth)
- 1-hour expiry encoded in token
- Server verifies signature on `confirmUpload` - no replay possible after ItemFile created

**Why JWT instead of in-memory storage:**

- Vercel serverless functions are stateless
- Each request may hit different instance
- JWT scales perfectly, no shared state needed

### Google Drive Client

**New function in `lib/google-drive-client.ts`:**

```typescript
/**
 * Creates a resumable upload URL for direct browser upload.
 * Uses Google Drive API's resumable upload protocol.
 *
 * CRITICAL: The origin parameter enables CORS for browser uploads.
 * Without it, browser XHR requests to the upload URL will be blocked.
 */
export async function createResumableUploadUrl(
  drive: drive_v3.Drive,
  fileName: string,
  mimeType: string,
  parentFolderId: string,
  origin: string // Browser origin for CORS headers
): Promise<string>;

// Implementation note: Must include origin in the initiation request:
// headers: { 'X-Upload-Content-Type': mimeType, 'Origin': origin }
```

### Client Component Changes

**Item Settings Dialog (`item-settings-dialog.tsx`):**

1. **Remove** ItemStats section
2. **Always show** file type comboboxes (even when no files)
3. **Convert** Select components to Combobox with upload capability
4. **Add** inline progress display during uploads

**Combobox behavior:**

```
Primary Media [Combobox]
├── existing-video.mp4 ✓ (selected)
├── another-video.mkv
├── ─────────────────────
└── + Upload Media Files...  ← Opens filtered file picker
```

When "Upload" selected:

1. File picker opens with `accept` filter for that file type
2. User can select multiple files
3. Combobox shows inline progress: "Uploading 2/3... 45%"
4. On complete, new files appear in combobox options
5. User can then select which file is primary

**File picker filters:**
| Combobox | Accept Filter |
|----------|---------------|
| Primary Media | `video/*,audio/*` |
| Primary Artwork | `image/*` |
| Hero Image | `image/*` |
| Default Subtitle | `.srt,.vtt,.sub,.ass` |

Windows and Mac will show non-matching files as disabled/greyed out.

**Items Toolbar (`items-toolbar.tsx`):**

- **Remove** upload button (moved to settings dialog)

### Upload State Management

```typescript
type UploadState = {
  status: "idle" | "uploading" | "error";
  files: Array<{
    name: string;
    progress: number; // 0-100
    status: "pending" | "uploading" | "success" | "error";
    error?: string;
  }>;
  successCount: number;
  errorCount: number;
};
```

### Progress Tracking

Use XMLHttpRequest for progress events:

```typescript
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  abortSignal?: AbortSignal // Optional: allows cancellation
): Promise<{ driveFileId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Handle abort signal for cancellation
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("Upload cancelled"));
      });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      // Google returns 200 or 201 for successful uploads
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({ driveFileId: response.id });
        } catch {
          reject(new Error("Invalid response from Google Drive"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}
```

### Batch Upload Flow

1. User clicks "Upload Media Files..." in combobox
2. File picker opens (filtered to media types, multiple allowed)
3. User selects 5 files
4. Client calls `createUploadSessions(itemId, fileMetadata[], window.location.origin)`
5. Server creates JWT tokens and CORS-enabled upload URLs for each file
6. Client uploads files in parallel (max 3 concurrent) using XHR
7. Progress bar shows overall: "Uploading 3/5... 67%"
8. As each completes, client calls `confirmUpload(sessionToken, driveFileId)`
9. On all complete:
   - Success: Combobox refreshes with new files as options
   - Partial failure: Show "3 uploaded, 2 failed. Retry?"
10. Failed files can be retried (requests new sessions with fresh tokens)

## Error Handling

### Google Drive API Errors

| Error                | Handling                                                           |
| -------------------- | ------------------------------------------------------------------ |
| 401 Unauthorized     | Refresh token, retry once. If fails, show "Reconnect Google Drive" |
| 403 Quota exceeded   | Show "Google Drive storage full"                                   |
| 404 Folder not found | Item's Drive folder was deleted - recreate it, retry               |
| Network timeout      | Auto-retry up to 3 times with exponential backoff                  |

### Client-Side Errors

| Error                     | Handling                                      |
| ------------------------- | --------------------------------------------- |
| File picker cancelled     | No action, return to idle                     |
| Browser closed mid-upload | Partial files may exist in Drive (no cleanup) |
| Session expired (1hr)     | Request new session on retry                  |

### Validation

- Check Google Drive is connected before showing upload option
- File type filtering via `accept` attribute on file input
- No file size validation (let Google Drive handle limits)

### Security

- Session IDs are UUIDs - can't guess/reuse
- `confirmUpload` validates session belongs to current user
- Each session can only be confirmed once
- User ID check on all operations

## UI Components

### FileTypeCombobox Component

New component that combines selection and upload:

```typescript
interface FileTypeComboboxProps {
  label: string;
  description: string;
  icon: LucideIcon;
  files: SerializedItemFile[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onUploadComplete: () => void;
  itemId: string;
  fileType: "media" | "artwork" | "subtitle";
  acceptFilter: string;
  disabled?: boolean;
}
```

Features:

- Searchable file list (Combobox pattern)
- "Upload" action at bottom of list
- Inline progress bar during upload
- Retry UI for failed uploads

## Files Changed

### Create

- None (all changes in existing files)

### Modify

1. `lib/google-drive-client.ts` - Add `createResumableUploadUrl()`
2. `lib/google-drive-actions.ts` - Add `createUploadSessions()`, `confirmUpload()`
3. `components/items/item-settings-dialog.tsx`:
   - Remove ItemStats section
   - Replace Select with FileTypeCombobox
   - Always show file type sections
4. `components/items/items-toolbar.tsx` - Remove upload button
5. `components/items/file-upload-button.tsx` - Delete or repurpose as utility

### Delete

- Old `uploadToGoogleDrive` server action (deprecated)

## Testing Strategy

### Unit Tests (Add)

**`tests/unit/lib/google-drive-actions.test.ts`:**

- `createUploadSessions` - returns URLs and JWT tokens for valid request
- `createUploadSessions` - includes origin in Google API request
- `createUploadSessions` - fails when Drive not connected
- `createUploadSessions` - fails when item not found
- `createUploadSessions` - validates file metadata (name, mimeType required)
- `createUploadSessions` - sanitizes fileName (no path traversal)
- `confirmUpload` - creates ItemFile record with valid JWT
- `confirmUpload` - fails for invalid JWT signature
- `confirmUpload` - fails for expired JWT
- `confirmUpload` - fails for JWT with wrong user ID
- `confirmUpload` - fails for duplicate driveFileId (already confirmed)

**`tests/unit/components/file-type-combobox.test.tsx`:**

- Renders file list
- Shows upload option
- Opens file picker with correct filter
- Shows progress during upload
- Handles successful upload
- Handles failed upload with retry
- Refreshes file list after upload

### Integration Tests (Add)

**`tests/integration/google-drive/upload.test.ts`:**

- Creates upload session with valid item
- Session contains correct metadata
- Confirms upload creates ItemFile in DB
- ItemFile has correct fileType based on mimeType
- Session expires after timeout
- Multiple sessions for batch upload
- Session cleanup after confirmation

### E2E Tests (Add)

**`e2e/journeys/google-drive/upload.spec.ts`:**

- Upload single media file via combobox
- Upload multiple artwork files (batch)
- Upload subtitle file
- Retry failed upload
- Upload without Drive connected shows appropriate UI
- Progress bar updates during upload
- New files appear in combobox after upload

### Security Tests (Add)

**`tests/unit/lib/google-drive-actions.test.ts` (security section):**

- `createUploadSessions` - rejects requests from unauthenticated users
- `createUploadSessions` - rejects access to items owned by other users
- `createUploadSessions` - sanitizes fileName to prevent path traversal (../)
- `confirmUpload` - rejects tampered JWT tokens
- `confirmUpload` - rejects JWT signed with wrong secret
- `confirmUpload` - prevents double-confirmation of same upload

**`tests/unit/components/file-type-combobox.test.tsx` (security section):**

- Escapes fileName in display to prevent XSS
- Validates accept filter matches expected file types

### Tests to Modify

**`tests/unit/components/items/items-toolbar.test.tsx`:**

- Remove upload button tests

**`tests/unit/components/items/item-settings-dialog.test.tsx`:**

- Remove ItemStats tests
- Add FileTypeCombobox integration tests
- Test comboboxes render even with no files

### Tests to Remove

- Any tests for old `uploadToGoogleDrive` server action
- `file-upload-button.test.tsx` (if component deleted)

## Implementation Order

1. **Server-side foundation:**
   - Add `createResumableUploadUrl()` to google-drive-client
   - Add `createUploadSessions()` action with session management
   - Add `confirmUpload()` action

2. **Client-side upload utility:**
   - Create `uploadWithProgress()` helper function
   - Create batch upload manager with concurrency control

3. **FileTypeCombobox component:**
   - Create new component with selection + upload
   - Integrate progress display
   - Add retry functionality

4. **Item Settings Dialog update:**
   - Remove ItemStats
   - Replace Select with FileTypeCombobox
   - Always show file sections
   - Wire up upload callbacks

5. **Cleanup:**
   - Remove upload button from toolbar
   - Remove/deprecate old upload code

6. **Testing:**
   - Unit tests for new actions
   - Unit tests for new component
   - Integration tests for upload flow
   - E2E tests for full journey

## Migration

- Old `uploadToGoogleDrive` can be removed immediately
- Breaking change is acceptable (internal API only)
- No gradual migration needed

## Future Enhancements

- Drag-and-drop upload onto combobox
- Upload progress in browser notification (for background uploads)
- Resume interrupted uploads (resumable upload protocol supports this)
