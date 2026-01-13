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

### 2.4 Quota Check Script

**Current Limitation:**
No visibility into API quota usage or user storage consumption.

**Problem:**

- Google Drive API has quotas (queries per day, per user, etc.)
- If quota exceeded, all sync operations fail
- No warning before hitting limits
- Can't identify users running low on Drive storage
- Can't identify abuse patterns

**Solution:**

Create a CLI script to check quotas for all connected users:

- Query Google Drive API for each user's storage quota
- Report users approaching storage limits (>80%, >90%)
- Track API call patterns from logs
- Output summary report for admin review

**Files to Create:**

- `scripts/check-quotas.ts` - CLI script for quota checking

**Script Output Example:**

```
$ pnpm run check-quotas

Google Drive Quota Report
=========================
Generated: 2026-01-13 10:30:00

Storage Warnings:
-----------------
user@example.com    14.2 GB / 15 GB (95%) ⚠️  CRITICAL
other@example.com   12.1 GB / 15 GB (81%) ⚠️  WARNING

Healthy Users: 23
Total Connected: 25

API Usage (last 24h):
---------------------
Total calls: 1,247
Peak user: user@example.com (342 calls)
```

**Implementation:**

```typescript
// scripts/check-quotas.ts
import { prisma } from "@/lib/prisma";
import { createDriveClient } from "@/lib/google-drive-client";

async function checkQuotas() {
  const connections = await prisma.googleDriveConnection.findMany({
    include: { user: true },
  });

  for (const conn of connections) {
    const drive = await createDriveClient(conn);
    const about = await drive.about.get({ fields: "storageQuota" });
    // Report quota usage...
  }
}

checkQuotas();
```

**Usage:**

```bash
# Run manually
pnpm run check-quotas

# Or add to cron for daily reports
0 9 * * * cd /app && pnpm run check-quotas >> /var/log/quota-check.log
```

**Effort:** ~1 day

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

- Show storage usage in sidebar Google Drive card
- Show storage in profile Settings dialog (Drive section)
- Warning badge when >90% full
- "Manage Storage" link to Google One
- Update quota on each sync

**Files to Modify:**

- `components/app-sidebar.tsx` - Add storage display to Drive card
- `components/google-drive/settings-section.tsx` - Add storage bar to settings

**UI Mockup (Sidebar):**

```
Google Drive
Connected as user@gmail.com
[============----] 14.2 GB / 15 GB
```

**UI Mockup (Settings):**

```
Storage
[============----] 14.2 GB / 15 GB (95%)
⚠️ Storage almost full
[Manage Storage ↗]
```

**Effort:** ~0.5 days

---

### 3.2 Batch Operations

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

### 3.3 Sync History / Activity Log

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
|          | 2.4 Quota Check Script   | 1 day    | **11 days**  |
| **P3**   | 3.1 Storage Quota UI     | 0.5 days |              |
|          | 3.2 Batch Operations     | 2 days   |              |
|          | 3.3 Sync History         | 2 days   | **4.5 days** |

**Total P2+P3:** ~15.5 days

---

## Implementation Order Recommendation

**P2 (in order):**

1. Large File Streaming (2 days) - Unblocks video uploads
2. Quota Check Script (1 day) - Quick admin visibility
3. Conflict Resolution (3 days) - Data integrity
4. Offline Queue (5 days) - Most complex, do last

**P3 (in order):**

1. Storage Quota UI (0.5 days) - Quick win, user visibility
2. Sync History (2 days) - Debugging aid
3. Batch Operations (2 days) - Performance
