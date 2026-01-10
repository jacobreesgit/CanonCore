# Google Drive P2-P3 Roadmap

> **For Claude:** These are post-MVP enhancements. Do NOT implement until P1 (main implementation plan) is complete and deployed.

**Related:** `docs/plans/2026-01-08-google-drive-implementation.md` (P1 - MVP)

**Status:** Not started - implement after MVP launch

---

## P2 - Should Address Soon After Launch

### 2.1 Large File Streaming Upload (>500MB)

**Current Limitation:**
Entire file loaded into memory as Buffer before upload.

**Problem:**

- 1GB video = 1GB RAM usage
- Browser may crash or timeout on large files
- Practical limit ~500MB

**Solution:**

- Accept `ReadableStream` from `<input type="file">` directly
- Pipe to Drive without buffering entire file
- Use true resumable upload protocol for files >5MB

**Files to Modify:**

- `lib/google-drive-client.ts` - `uploadFile()` function
- `lib/google-drive-actions.ts` - `uploadToGoogleDrive()` action
- `components/items/file-upload-button.tsx` - Pass stream instead of buffer

**Implementation Notes:**

```typescript
// Instead of:
const buffer = await file.arrayBuffer();
await uploadFile(drive, name, Buffer.from(buffer), mimeType, parentId);

// Use:
const stream = file.stream();
await uploadFileStream(drive, name, stream, file.size, mimeType, parentId);
```

**Effort:** ~2 days

---

### 2.2 Conflict Resolution

**Current Limitation:**
Last write wins silently. No detection or warning.

**Problem:**

- User renames "Movie.mp4" → "Film.mp4" on web
- Someone renames it → "Video.mp4" in Drive app simultaneously
- One change is lost with no notification

**Solution:**

- Compare `modifiedTime` before write operations
- If server version is newer than expected, prompt user:
  - "This file was modified elsewhere"
  - Options: "Overwrite" / "Keep both" / "Cancel"
- Store `expectedModifiedTime` when fetching items

**Files to Modify:**

- `lib/google-drive-client.ts` - Add `checkModifiedTime()` helper
- `lib/google-drive-actions.ts` - Pre-check before rename/move/delete
- `components/items/` - Add conflict resolution dialog

**Schema Addition:**

```prisma
model Item {
  // ... existing fields
  driveModifiedAt    DateTime?  // Track last known Drive modifiedTime
}
```

**Effort:** ~3 days

---

### 2.3 Offline Queue / Background Retry

**Current Limitation:**
If Drive API fails, operation fails immediately. User must manually retry.

**Problem:**

- Flaky connection = lost changes
- User creates folder on train, goes through tunnel, folder creation lost
- No persistence of pending operations

**Solution:**

- Queue failed operations in IndexedDB (client-side)
- Retry with exponential backoff when online
- Show "3 pending changes" indicator in UI
- Process queue on page load and connectivity change

**Files to Create:**

- `lib/sync-queue.ts` - IndexedDB queue management
- `components/sync/pending-changes-indicator.tsx` - UI badge

**Implementation Options:**

1. **Client-side (IndexedDB + Service Worker)** - Simpler, works offline
2. **Server-side (BullMQ + Redis)** - More robust, survives browser close

**Recommended:** Start with client-side, migrate to server-side if needed.

**Queue Schema:**

```typescript
interface PendingOperation {
  id: string;
  type: "create" | "rename" | "delete" | "move" | "upload";
  payload: Record<string, unknown>;
  attempts: number;
  lastAttempt: Date;
  error?: string;
}
```

**Effort:** ~5 days

---

### 2.4 Upload Cancellation

**Current Limitation:**
No way to cancel in-progress upload.

**Problem:**

- User starts uploading wrong 2GB file
- Can't stop it - must wait or refresh page
- Refreshing may leave partial file on Drive

**Solution:**

- Pass `AbortController` signal to upload function
- Add "Cancel" button to upload progress UI
- Clean up partial file on Drive if cancelled
- Handle `AbortError` gracefully

**Files to Modify:**

- `lib/google-drive-client.ts` - Add `signal` parameter to `uploadFile()`
- `components/items/file-upload-button.tsx` - Add cancel button and AbortController

**Implementation:**

```typescript
export async function uploadFile(
  drive: drive_v3.Drive,
  name: string,
  content: Buffer | Readable,
  mimeType: string,
  parentId: string,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal // NEW
): Promise<{ id: string; name: string }>;
```

**Effort:** ~1 day

---

### 2.5 Structured Logging Integration

**Current Limitation:**
Uses `console.log` / `console.error` throughout Google Drive code.

**Problem:**

- No visibility in production
- Can't debug user issues
- No metrics or alerting
- Inconsistent with rest of codebase (which uses Pino)

**Solution:**

- Replace all `console.*` with existing `logger.ts` (Pino)
- Add request IDs for distributed tracing
- Log: sync duration, file counts, error rates, API latency
- Add structured context (userId, connectionId, operation)

**Files to Modify:**

- `lib/google-drive-client.ts` - Import and use logger
- `lib/google-drive-actions.ts` - Import and use logger
- `app/api/auth/google-drive/callback/route.ts` - Import and use logger

**Example:**

```typescript
// Before:
console.error("Sync failed:", error);

// After:
import { createUserLogger } from "@/lib/logger";
const logger = createUserLogger(userId);
logger.error({ err: error, operation: "sync", connectionId }, "Sync failed");
```

**Effort:** ~1 day

---

### 2.6 Google API Quota Monitoring

**Current Limitation:**
Rate limiting exists but no visibility into quota usage.

**Problem:**

- Google Drive API has quotas (queries per day, per user, etc.)
- If quota exceeded, all sync operations fail
- No warning before hitting limits
- Can't identify abuse patterns

**Solution:**

- Track API calls per user per day in database
- Dashboard showing quota usage percentage
- Alert at 80% threshold
- Graceful degradation: "Sync paused until tomorrow"

**Schema Addition:**

```prisma
model ApiUsage {
  id        String   @id @default(cuid())
  userId    String
  date      DateTime @db.Date
  calls     Int      @default(0)

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
}
```

**Files to Create:**

- `lib/api-quota.ts` - Quota tracking and checking
- `components/settings/quota-usage.tsx` - Usage display

**Effort:** ~2 days

---

## P3 - Nice to Have

### 3.1 Drive Storage Quota UI

**Current Limitation:**
`quotaBytesUsed`/`quotaBytesTotal` stored in database but not displayed to user.

**Problem:**

- User doesn't know they're at 14.9GB of 15GB until upload fails
- No proactive warning about low storage
- Must check Drive app separately

**Solution:**

- Show "Drive Storage: 14.9 GB / 15 GB" in Settings dialog
- Warning badge when >90% full
- "Upgrade storage" link to Google One
- Update quota on each sync

**Files to Modify:**

- `components/profile/settings-dialog.tsx` - Add storage display section

**UI Mockup:**

```
Google Drive Storage
[============----] 14.2 GB / 15 GB (95%)
⚠️ Storage almost full
[Manage Storage ↗]
```

**Effort:** ~0.5 days

---

### 3.2 Upload Progress UI Component

**Current Limitation:**
`onProgress` callback exists in `uploadFile()` but nothing uses it.

**Problem:**

- Large upload shows no feedback
- User thinks app is frozen
- No indication of upload speed or time remaining

**Solution:**

- Progress bar component with percentage and bytes
- "Uploading video.mp4... 45% (234 MB / 520 MB)"
- Estimated time remaining based on speed
- Cancel button (see 2.4)

**Files to Create:**

- `components/items/upload-progress.tsx` - Progress bar component

**UI Mockup:**

```
┌─────────────────────────────────────────┐
│ Uploading video.mp4                     │
│ [████████████░░░░░░░░] 62%              │
│ 324 MB / 520 MB • ~2 min remaining      │
│                              [Cancel]   │
└─────────────────────────────────────────┘
```

**Effort:** ~1 day

---

### 3.3 Batch Operations

**Current Limitation:**
Delete 50 items = 50 sequential API calls.

**Problem:**

- Slow: each call has ~100-200ms overhead
- Deleting a folder with 100 children takes 10-20 seconds
- Poor UX for bulk operations

**Solution:**

- Use Google Drive Batch API (up to 100 operations per request)
- Single HTTP request for bulk delete/move/rename
- Significant performance improvement for bulk actions

**Files to Modify:**

- `lib/google-drive-client.ts` - Add `batchDelete()`, `batchMove()` functions

**Implementation:**

```typescript
export async function batchDelete(
  drive: drive_v3.Drive,
  fileIds: string[]
): Promise<{ succeeded: string[]; failed: string[] }> {
  // Use drive.newBatch() or manual multipart request
}
```

**Effort:** ~2 days

---

### 3.4 Selective Sync

**Current Limitation:**
All items sync to Google Drive automatically.

**Problem:**

- User may want some folders local-only
- Drafts, private notes, temporary files
- No granular control over what syncs

**Solution:**

- "Don't sync this folder" toggle per item
- `syncEnabled: boolean` field on Item model
- Skip items with `syncEnabled: false` in sync operations
- Visual indicator for non-synced items

**Schema Addition:**

```prisma
model Item {
  // ... existing fields
  syncEnabled    Boolean   @default(true)
}
```

**Files to Modify:**

- `lib/google-drive-actions.ts` - Filter by syncEnabled
- `components/items/item-settings-dialog.tsx` - Add toggle

**Effort:** ~2 days

---

### 3.5 Sync History / Activity Log

**Current Limitation:**
No record of what synced when.

**Problem:**

- "Did my changes sync?" - no way to verify
- Can't troubleshoot sync issues
- No audit trail

**Solution:**

- `SyncLog` table: timestamp, action, itemId, status, details
- "Recent Activity" panel showing last 20 sync operations
- "Synced 5 minutes ago" timestamp indicator
- Error details for failed operations

**Schema Addition:**

```prisma
model SyncLog {
  id          String   @id @default(cuid())
  userId      String
  action      String   // 'create', 'rename', 'delete', 'upload', 'sync'
  itemId      String?
  itemName    String?
  status      String   // 'success', 'failed'
  error       String?
  duration    Int?     // milliseconds
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

**Files to Create:**

- `lib/sync-log.ts` - Logging functions
- `components/settings/sync-history.tsx` - Activity panel

**Effort:** ~2 days

---

## Summary

| Priority | Item                     | Effort   | Total        |
| -------- | ------------------------ | -------- | ------------ |
| **P2**   | 2.1 Large File Streaming | 2 days   |              |
|          | 2.2 Conflict Resolution  | 3 days   |              |
|          | 2.3 Offline Queue        | 5 days   |              |
|          | 2.4 Upload Cancellation  | 1 day    |              |
|          | 2.5 Structured Logging   | 1 day    |              |
|          | 2.6 API Quota Monitoring | 2 days   | **14 days**  |
| **P3**   | 3.1 Storage Quota UI     | 0.5 days |              |
|          | 3.2 Upload Progress UI   | 1 day    |              |
|          | 3.3 Batch Operations     | 2 days   |              |
|          | 3.4 Selective Sync       | 2 days   |              |
|          | 3.5 Sync History         | 2 days   | **7.5 days** |

**Total P2+P3:** ~21.5 days

---

## Implementation Order Recommendation

**P2 (in order):**

1. Structured Logging (1 day) - Enables debugging for everything else
2. Upload Cancellation (1 day) - Quick win, improves UX
3. Large File Streaming (2 days) - Unblocks video uploads
4. API Quota Monitoring (2 days) - Prevents production outages
5. Conflict Resolution (3 days) - Data integrity
6. Offline Queue (5 days) - Most complex, do last

**P3 (in order):**

1. Upload Progress UI (1 day) - Pairs with large file streaming
2. Storage Quota UI (0.5 days) - Quick win
3. Sync History (2 days) - Debugging aid
4. Batch Operations (2 days) - Performance
5. Selective Sync (2 days) - Feature request dependent
