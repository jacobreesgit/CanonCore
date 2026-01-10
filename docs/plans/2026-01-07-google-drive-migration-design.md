# Google Drive Migration Design

> **Status:** Approved
> **Created:** 2026-01-07
> **Updated:** 2026-01-07 (bidirectional sync)
> **Supersedes:** 2026-01-07-sftp-sync-resilience-design.md

## Overview

Complete replacement of SFTP-based storage with Google Drive API for **full bidirectional sync**. Users can manage their media library from either CanonCore or Google Drive - changes propagate both ways.

**Key capabilities:**

- Create items in CanonCore → folders appear in Google Drive
- Add files to Drive folder → they sync to CanonCore
- Rename/move/delete in either place → changes sync
- Stable file IDs eliminate duplicates on rename/move

## Problem Statement

SFTP has fundamental limitations that cannot be solved:

| Limitation                       | Root Cause                         |
| -------------------------------- | ---------------------------------- |
| Folder rename creates duplicates | Path-based matching, no stable IDs |
| File move creates duplicates     | Path-based matching, no stable IDs |
| Full re-scan required            | No change detection API            |
| Complex user setup               | Host, port, credentials, WebDAV    |
| Real-time sync impossible        | No webhooks/push notifications     |
| One-way sync only                | No write capability from web       |

Google Drive solves all of these with stable file IDs, a changes API, and full read/write access.

## Solution

### OAuth 2.0 Authentication

Users authorize CanonCore once via Google's consent screen. We store encrypted refresh tokens for ongoing access.

**Required OAuth Scope:**

```
https://www.googleapis.com/auth/drive.file
```

This scope allows full read/write access to files and folders that CanonCore creates, plus any files the user adds to those folders. It does NOT access the user's other Drive files (sandboxed).

**Why `drive.file` (not `drive.readonly`):**

| Scope            | Access               | Verification          | Our Use Case               |
| ---------------- | -------------------- | --------------------- | -------------------------- |
| `drive.readonly` | Read all files       | Sensitive (2-4 weeks) | ❌ Can't create folders    |
| `drive.file`     | Read/write app files | Standard (faster)     | ✅ Full bidirectional sync |

**What `drive.file` gives us:**

- ✅ Create folders when user creates items
- ✅ Upload files from CanonCore
- ✅ Read/modify files we created
- ✅ Access files user adds to our folders
- ❌ Cannot see user's other Drive files (good for privacy)

**User Flow:**

1. User clicks "Connect Google Drive"
2. Redirected to Google consent screen
3. User grants `drive.file` permission
4. Google redirects back with authorization code
5. Exchange code for access + refresh tokens
6. CanonCore creates "CanonCore" root folder in user's Drive
7. Store encrypted tokens + root folder ID in database
8. Connection ready for bidirectional sync

**Token Management:**

- Access tokens expire in 1 hour
- Refresh tokens are long-lived (until user revokes)
- Cache access tokens to reduce API calls
- Auto-refresh when access token expires
- `needsReauth` flag if refresh fails (user revoked access)

**Token Refresh Implementation:**

```typescript
// lib/google-drive-client.ts
import { google, drive_v3 } from "googleapis";

export async function refreshAccessToken(
  connection: GoogleDriveConnection
): Promise<string> {
  const refreshToken = decryptCredential(connection.encryptedRefreshToken);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    // User may have revoked access
    await prisma.googleDriveConnection.update({
      where: { id: connection.id },
      data: { needsReauth: true, lastError: "Token refresh failed" },
    });
    throw new Error("Token refresh failed - user must reconnect");
  }

  const { access_token, expires_in } = await response.json();

  // Cache the new access token
  await prisma.googleDriveConnection.update({
    where: { id: connection.id },
    data: {
      encryptedAccessToken: encryptCredential(access_token),
      accessTokenExpiry: new Date(Date.now() + expires_in * 1000),
      needsReauth: false,
    },
  });

  return access_token;
}

export async function getDriveClient(
  connection: GoogleDriveConnection
): Promise<drive_v3.Drive> {
  // Check if access token is expired or missing
  const needsRefresh =
    !connection.accessTokenExpiry ||
    new Date(connection.accessTokenExpiry) < new Date(Date.now() + 60000); // 1 min buffer

  let accessToken: string;

  if (needsRefresh) {
    accessToken = await refreshAccessToken(connection);
  } else {
    accessToken = decryptCredential(connection.encryptedAccessToken!);
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.drive({ version: "v3", auth });
}
```

### Database Schema

```prisma
enum SyncStatus {
  SYNCED      // Up to date with Drive
  PENDING     // Local changes not yet pushed
  SYNCING     // Currently uploading/downloading
  ERROR       // Sync failed
}

model GoogleDriveConnection {
  id                    String    @id @default(cuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name                  String    // "My Google Drive"
  email                 String    // Google account email (for display)

  // OAuth tokens (all encrypted with ENCRYPTION_KEY)
  encryptedRefreshToken String    // Long-lived, for getting new access tokens
  encryptedAccessToken  String?   // Cached, 1-hour expiry
  accessTokenExpiry     DateTime? // When to refresh

  // Root folder (created on first connect)
  rootFolderId          String    // "CanonCore" folder ID in user's Drive (REQUIRED)
  changePageToken       String?   // For incremental sync (expires after ~7 days inactive)

  // User's Drive quota (optional, for display)
  quotaBytesUsed        BigInt?
  quotaBytesTotal       BigInt?

  // Status
  isActive              Boolean   @default(true)
  needsReauth           Boolean   @default(false)
  lastSyncAt            DateTime?
  lastError             String?

  items                 Item[]

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([userId, email])
  @@index([userId])
}

model Item {
  // ... existing fields (id, name, description, order, depth, parentId, userId, etc.)

  // Google Drive sync
  driveFileId           String?     // Google Drive file ID (stable, survives rename/move)
  driveModifiedAt       DateTime?   // Last modified time from Drive
  driveThumbnailUrl     String?     // Google-provided thumbnail URL
  syncStatus            SyncStatus  @default(SYNCED)
  syncError             String?     // Error message if syncStatus = ERROR

  connectionId          String?
  connection            GoogleDriveConnection? @relation(fields: [connectionId], references: [id], onDelete: SetNull)

  // IMPORTANT: Unique constraint prevents duplicates during sync
  @@unique([connectionId, driveFileId])
  @@index([userId])
  @@index([parentId])
  @@index([syncStatus])  // For finding pending/error items
}

model ItemFile {
  // ... existing fields (id, itemId, filename, fileType, mimeType, size, etc.)

  driveFileId           String      // Google Drive file ID
  syncStatus            SyncStatus  @default(SYNCED)
  syncError             String?

  @@unique([itemId, driveFileId])
  @@index([itemId])
}
```

**Schema Design Decisions:**

1. **Token Caching:** Store both refresh and access tokens. Access tokens are cached to reduce Google API calls. Refresh when `accessTokenExpiry` is past.

2. **Unique Constraint:** `@@unique([connectionId, driveFileId])` ensures sync cannot create duplicates. If we try to insert a duplicate, Prisma throws an error we can catch and update instead.

3. **Single Parent:** Google Drive API v3 enforces single-parent for files. This matches our existing Item hierarchy model.

4. **Sync Status:** Each item tracks its sync state for badge display and retry logic. Index on `syncStatus` for efficient queries.

5. **Root Folder Required:** `rootFolderId` is required (not optional) because we create the "CanonCore" folder on first connect.

6. **Order is CanonCore-only:** Item `order` field is local metadata for display ordering. Drive has no concept of order, so this doesn't sync. This matches current SFTP behavior.

7. **Connection Deletion:** When user disconnects a Google Drive connection:
   - CanonCore items are deleted (cascade)
   - Drive "CanonCore" folder is moved to trash (recoverable for 30 days)
   - Matches SFTP behavior where removing connection removes synced data

### Sync Logic (Bidirectional)

Sync works in both directions:

1. **Pull from Drive:** Detect changes in Drive, update CanonCore
2. **Push to Drive:** When user creates/modifies items in CanonCore, update Drive

#### Push to Drive (CanonCore → Drive)

When user creates an item in CanonCore:

```typescript
async function createItemWithDrive(
  userId: string,
  name: string,
  parentId: string | null,
  connectionId: string
) {
  const connection = await getConnection(connectionId, userId);
  if (!connection) {
    throw new Error("Connection not found or access denied");
  }

  const drive = await getDriveClient(connection);

  // Find parent item (if any) for depth calculation and Drive folder ID
  let parentDriveId = connection.rootFolderId;
  let depth = 0;

  if (parentId) {
    const parent = await prisma.item.findUnique({ where: { id: parentId } });
    if (!parent?.driveFileId) {
      throw new Error("Parent item not synced to Drive");
    }
    parentDriveId = parent.driveFileId;
    depth = (parent.depth ?? 0) + 1;
  }

  // Get next order value for siblings
  const maxOrder = await prisma.item.aggregate({
    where: { userId, parentId },
    _max: { order: true },
  });
  const order = (maxOrder._max.order ?? -1) + 1;

  // Create folder in Drive
  const driveFolder = await withRateLimit(() =>
    drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentDriveId],
      },
      fields: "id, name, modifiedTime",
    })
  );

  // Create item in database with Drive ID
  const item = await prisma.item.create({
    data: {
      userId,
      name,
      parentId,
      connectionId,
      depth,
      order,
      driveFileId: driveFolder.data.id,
      driveModifiedAt: new Date(driveFolder.data.modifiedTime!),
      syncStatus: "SYNCED",
    },
  });

  return item;
}
```

When user renames an item:

```typescript
async function renameItemWithDrive(itemId: string, newName: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { connection: true },
  });

  if (item?.driveFileId && item.connection) {
    const drive = await getDriveClient(item.connection);

    await withRateLimit(() =>
      drive.files.update({
        fileId: item.driveFileId,
        requestBody: { name: newName },
      })
    );
  }

  await prisma.item.update({
    where: { id: itemId },
    data: { name: newName, syncStatus: "SYNCED" },
  });
}
```

When user deletes an item:

```typescript
async function deleteItemWithDrive(itemId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { connection: true },
  });

  if (item?.driveFileId && item.connection) {
    const drive = await getDriveClient(item.connection);

    // Move to trash (recoverable) instead of permanent delete
    await withRateLimit(() =>
      drive.files.update({
        fileId: item.driveFileId,
        requestBody: { trashed: true },
      })
    );
  }

  // Cascade delete in database
  await prisma.item.delete({ where: { id: itemId } });
}
```

When user moves an item (reparent via drag-drop):

```typescript
async function moveItemWithDrive(itemId: string, newParentId: string | null) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { connection: true, parent: true },
  });

  if (item?.driveFileId && item.connection) {
    const drive = await getDriveClient(item.connection);

    // Get new parent's Drive folder ID
    const newParentDriveId = newParentId
      ? (await prisma.item.findUnique({ where: { id: newParentId } }))
          ?.driveFileId
      : item.connection.rootFolderId;

    // Update parent in Drive
    await withRateLimit(() =>
      drive.files.update({
        fileId: item.driveFileId,
        addParents: newParentDriveId,
        removeParents: item.parent?.driveFileId || item.connection.rootFolderId,
      })
    );
  }

  // Calculate new depth from parent
  let newDepth = 0;
  if (newParentId) {
    const newParent = await prisma.item.findUnique({
      where: { id: newParentId },
    });
    newDepth = newParent?.depth != null ? newParent.depth + 1 : 0;
  }

  // Use transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: { id: itemId },
      data: { parentId: newParentId, depth: newDepth, syncStatus: "SYNCED" },
    });

    // Recursively update all descendant depths in a single transaction
    await updateDescendantDepths(tx, itemId, newDepth);
  });
}

async function updateDescendantDepths(
  tx: Prisma.TransactionClient,
  parentId: string,
  parentDepth: number
) {
  // Get all descendants in one query using recursive CTE approach
  // For Prisma, we batch update level by level
  const children = await tx.item.findMany({
    where: { parentId },
    select: { id: true },
  });

  if (children.length === 0) return;

  const childIds = children.map((c) => c.id);
  const childDepth = parentDepth + 1;

  // Batch update all children at this level
  await tx.item.updateMany({
    where: { id: { in: childIds } },
    data: { depth: childDepth },
  });

  // Recursively update grandchildren (parallelized)
  await Promise.all(
    childIds.map((childId) => updateDescendantDepths(tx, childId, childDepth))
  );
}
```

When user uploads a file through CanonCore:

```typescript
async function uploadFileToDrive(
  itemId: string,
  file: File,
  fileType: FileType
) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { connection: true },
  });

  if (!item?.driveFileId || !item.connection) {
    throw new Error("Item not connected to Drive");
  }

  const drive = await getDriveClient(item.connection);

  // Upload file to Drive (inside item's folder)
  const driveFile = await withRateLimit(() =>
    drive.files.create({
      requestBody: {
        name: file.name,
        parents: [item.driveFileId],
      },
      media: {
        mimeType: file.type,
        body: file.stream(),
      },
      fields: "id, name, mimeType, size, modifiedTime",
    })
  );

  // Create ItemFile record
  const itemFile = await prisma.itemFile.create({
    data: {
      itemId,
      driveFileId: driveFile.data.id,
      filename: file.name,
      fileType,
      mimeType: file.type,
      size: BigInt(driveFile.data.size || 0),
      syncStatus: "SYNCED",
    },
  });

  return itemFile;
}
```

When user deletes a connection:

```typescript
async function deleteConnectionWithDrive(connectionId: string) {
  const connection = await prisma.googleDriveConnection.findUnique({
    where: { id: connectionId },
  });

  if (connection) {
    const drive = await getDriveClient(connection);

    // Move CanonCore folder to trash (recoverable for 30 days)
    await withRateLimit(() =>
      drive.files.update({
        fileId: connection.rootFolderId,
        requestBody: { trashed: true },
      })
    );
  }

  // Cascade deletes items in database
  await prisma.googleDriveConnection.delete({
    where: { id: connectionId },
  });
}
```

#### Pull from Drive (Drive → CanonCore)

**Initial Sync (Full Traversal):**

```typescript
async function initialSync(connection: GoogleDriveConnection) {
  const drive = await getDriveClient(connection);

  // Clear caches at start of sync
  clearParentChainCache();
  clearSyncConflicts();

  // rootFolderId is required - validated on connection creation
  if (!connection.rootFolderId) {
    throw new Error("Connection missing rootFolderId - reconnect required");
  }

  // Get initial page token BEFORE syncing (captures current state)
  const tokenResponse = await drive.changes.getStartPageToken();
  const startPageToken = tokenResponse.data.startPageToken;

  if (!startPageToken) {
    throw new Error("Failed to get start page token from Google Drive");
  }

  // Recursively sync all folders
  await syncFolder(drive, connection, connection.rootFolderId, null, 0);

  // Save page token for incremental syncs
  await prisma.googleDriveConnection.update({
    where: { id: connection.id },
    data: { changePageToken: startPageToken, lastSyncAt: new Date() },
  });

  // Return any conflicts for UI notification
  return { conflicts: getSyncConflicts() };
}

async function syncFolder(
  drive: drive_v3.Drive,
  connection: GoogleDriveConnection,
  folderId: string,
  parentItemId: string | null,
  depth: number
) {
  if (depth > 10) return; // Max depth limit

  // Get current max order ONCE before pagination loop
  const maxOrder = await prisma.item.aggregate({
    where: { userId: connection.userId, parentId: parentItemId },
    _max: { order: true },
  });
  let nextOrder = (maxOrder._max.order ?? -1) + 1;

  let pageToken: string | undefined;

  do {
    // Fetch files in folder with pagination
    const response = await withRateLimit(() =>
      drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        pageSize: 1000,
        pageToken,
        fields:
          "nextPageToken, files(id, name, mimeType, modifiedTime, size, thumbnailLink, parents)",
      })
    );

    for (const file of response.data.files || []) {
      const isFolder = file.mimeType === "application/vnd.google-apps.folder";

      // Upsert item (unique constraint handles duplicates)
      const item = await prisma.item.upsert({
        where: {
          connectionId_driveFileId: {
            connectionId: connection.id,
            driveFileId: file.id,
          },
        },
        create: {
          connectionId: connection.id,
          userId: connection.userId,
          driveFileId: file.id,
          name: file.name,
          driveModifiedAt: new Date(file.modifiedTime),
          driveThumbnailUrl: file.thumbnailLink,
          parentId: parentItemId,
          depth,
          order: nextOrder++,
          syncStatus: "SYNCED",
        },
        update: {
          name: file.name,
          driveModifiedAt: new Date(file.modifiedTime),
          driveThumbnailUrl: file.thumbnailLink,
          parentId: parentItemId,
          depth,
        },
      });

      if (isFolder) {
        await syncFolder(drive, connection, file.id, item.id, depth + 1);
      } else {
        await syncItemFile(item.id, file);
      }
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);
}

// Sync a single file to ItemFile record
async function syncItemFile(itemId: string, file: drive_v3.Schema$File) {
  const fileType = categorizeFileType(file.mimeType || "", file.name || "");

  await prisma.itemFile.upsert({
    where: {
      itemId_driveFileId: { itemId, driveFileId: file.id! },
    },
    create: {
      itemId,
      driveFileId: file.id!,
      filename: file.name || "unknown",
      fileType,
      mimeType: file.mimeType || "application/octet-stream",
      size: file.size ? BigInt(file.size) : null,
      syncStatus: "SYNCED",
    },
    update: {
      filename: file.name || "unknown",
      mimeType: file.mimeType || "application/octet-stream",
      size: file.size ? BigInt(file.size) : null,
      syncStatus: "SYNCED",
    },
  });
}

// Categorize file by MIME type and extension
function categorizeFileType(mimeType: string, filename: string): FileType {
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
    return "MEDIA";
  }
  if (mimeType.startsWith("image/")) {
    return "ARTWORK";
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["srt", "vtt", "sub", "ass"].includes(ext || "")) {
    return "SUBTITLE";
  }
  return "MEDIA"; // Default to media for unknown types
}
```

**Incremental Sync (Changes Only):**

```typescript
async function incrementalSync(connection: GoogleDriveConnection) {
  const drive = await getDriveClient(connection);

  // Clear caches at start of sync
  clearParentChainCache();
  clearSyncConflicts();

  // If no page token, fall back to full sync
  if (!connection.changePageToken) {
    return initialSync(connection);
  }

  let pageToken = connection.changePageToken;
  let newStartPageToken: string | undefined;

  try {
    do {
      const response = await withRateLimit(() =>
        drive.changes.list({
          pageToken,
          pageSize: 1000,
          fields:
            "newStartPageToken, nextPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, size, thumbnailLink, parents, trashed))",
        })
      );

      for (const change of response.data.changes || []) {
        if (change.removed || change.file?.trashed) {
          await handleFileRemoved(connection.id, change.fileId);
        } else if (change.file) {
          await handleFileChanged(connection, change.file);
        }
      }

      // Save new start token when we reach the end
      if (response.data.newStartPageToken) {
        newStartPageToken = response.data.newStartPageToken;
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);

    // Update connection with new page token
    await prisma.googleDriveConnection.update({
      where: { id: connection.id },
      data: {
        changePageToken: newStartPageToken,
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    // Return any conflicts for UI notification
    return { conflicts: getSyncConflicts() };
  } catch (error: unknown) {
    // Page token expired (>7 days inactive) - fall back to full sync
    const isExpiredToken =
      error instanceof Error &&
      ((error as any).code === 404 || error.message?.includes("pageToken"));
    if (isExpiredToken) {
      console.warn("Change page token expired, performing full sync");
      return await initialSync(connection);
    } else {
      throw error;
    }
  }
}

async function handleFileRemoved(
  connectionId: string,
  fileId: string | null | undefined
) {
  if (!fileId) return;

  // Use delete (not deleteMany) to trigger Prisma cascade for children/files
  const item = await prisma.item.findFirst({
    where: { connectionId, driveFileId: fileId },
  });
  if (item) {
    await prisma.item.delete({ where: { id: item.id } });
  }
}

// Cache for parent chain lookups (cleared per sync operation)
const parentChainCache = new Map<string, boolean>();

// Collected during sync, displayed after completion
const syncConflicts: Array<{
  itemName: string;
  resolution: "drive" | "local";
}> = [];

async function handleFileChanged(
  connection: GoogleDriveConnection,
  file: drive_v3.Schema$File
) {
  if (!file.id) return;

  // IMPORTANT: Changes API returns ALL changes for files we have access to
  // Filter to only process files within our CanonCore folder tree
  const isInOurTree = await isFileInCanonCoreTree(
    connection,
    file.id,
    file.parents?.[0]
  );
  if (!isInOurTree) {
    return; // Not our file, ignore
  }

  const isFolder = file.mimeType === "application/vnd.google-apps.folder";

  // Check if item already exists (for conflict detection)
  const existingItem = await prisma.item.findFirst({
    where: { connectionId: connection.id, driveFileId: file.id },
  });

  // Detect and resolve conflicts for existing items
  if (existingItem) {
    const hasConflict = await detectConflict(existingItem, file);
    if (hasConflict) {
      const result = await resolveConflict(existingItem, file);
      syncConflicts.push({
        itemName: existingItem.name,
        resolution: result.resolved,
      });
      // Conflict resolved - item already updated by resolveConflict
      if (!isFolder) {
        await syncItemFile(existingItem.id, file);
      }
      return;
    }
  }

  // Find parent item by Drive parent ID
  const parentDriveId = file.parents?.[0];
  let parentItemId: string | null = null;
  let depth = 0;

  if (parentDriveId && parentDriveId !== connection.rootFolderId) {
    const parentItem = await prisma.item.findFirst({
      where: { connectionId: connection.id, driveFileId: parentDriveId },
    });
    if (parentItem) {
      parentItemId = parentItem.id;
      depth = parentItem.depth != null ? parentItem.depth + 1 : 0;
    }
  }

  // Get next order value for new items
  const maxOrder = await prisma.item.aggregate({
    where: { userId: connection.userId, parentId: parentItemId },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  // Upsert the item
  const item = await prisma.item.upsert({
    where: {
      connectionId_driveFileId: {
        connectionId: connection.id,
        driveFileId: file.id,
      },
    },
    create: {
      connectionId: connection.id,
      userId: connection.userId,
      driveFileId: file.id,
      name: file.name || "Untitled",
      driveModifiedAt: file.modifiedTime
        ? new Date(file.modifiedTime)
        : new Date(),
      driveThumbnailUrl: file.thumbnailLink,
      parentId: parentItemId,
      depth,
      order: nextOrder,
      syncStatus: "SYNCED",
    },
    update: {
      name: file.name || "Untitled",
      driveModifiedAt: file.modifiedTime
        ? new Date(file.modifiedTime)
        : undefined,
      driveThumbnailUrl: file.thumbnailLink,
      parentId: parentItemId,
      depth,
    },
  });

  // Sync files for non-folder items
  if (!isFolder) {
    await syncItemFile(item.id, file);
  }
}

// Clear conflicts at start of sync, return them at end for UI display
function clearSyncConflicts() {
  syncConflicts.length = 0;
}

function getSyncConflicts() {
  return [...syncConflicts];
}

// Helper: Check if a file is within our CanonCore folder tree
// Uses caching to avoid repeated API calls for the same parent chain
async function isFileInCanonCoreTree(
  connection: GoogleDriveConnection,
  fileId: string,
  immediateParent?: string | null
): Promise<boolean> {
  // Quick check: if immediate parent is our root, it's in our tree
  if (immediateParent === connection.rootFolderId) {
    parentChainCache.set(fileId, true);
    return true;
  }

  // Check cache first
  if (parentChainCache.has(fileId)) {
    return parentChainCache.get(fileId)!;
  }

  // If we have the immediate parent cached, use that
  if (immediateParent && parentChainCache.has(immediateParent)) {
    const result = parentChainCache.get(immediateParent)!;
    parentChainCache.set(fileId, result);
    return result;
  }

  // First, check if parent exists in our database (much faster than API)
  if (immediateParent) {
    const parentInDb = await prisma.item.findFirst({
      where: { connectionId: connection.id, driveFileId: immediateParent },
    });
    if (parentInDb) {
      parentChainCache.set(fileId, true);
      return true;
    }
  }

  // Fall back to API walk (only for files not yet in our tree)
  const drive = await getDriveClient(connection);
  let currentId = immediateParent || fileId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    if (currentId === connection.rootFolderId) {
      parentChainCache.set(fileId, true);
      return true;
    }
    visited.add(currentId);

    try {
      const file = await withRateLimit(() =>
        drive.files.get({
          fileId: currentId,
          fields: "parents",
        })
      );
      currentId = file.data.parents?.[0];
    } catch {
      parentChainCache.set(fileId, false);
      return false; // File doesn't exist or no access
    }
  }

  parentChainCache.set(fileId, false);
  return false;
}

// Clear cache at start of each sync operation
function clearParentChainCache() {
  parentChainCache.clear();
}
```

### Rate Limiting

Google Drive API has strict quotas that must be respected:

| Quota                               | Limit  |
| ----------------------------------- | ------ |
| Queries per 100 seconds per user    | 20,000 |
| Queries per 100 seconds per project | 12,000 |

**Implementation:**

```typescript
// lib/google-drive-client.ts
import Bottleneck from "bottleneck";

// Rate limiter: max 10 concurrent, 100ms between requests (10/sec)
const rateLimiter = new Bottleneck({
  maxConcurrent: 10,
  minTime: 100,
});

export async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return rateLimiter.schedule(async () => {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        // Normalize error to Error type
        lastError = error instanceof Error ? error : new Error(String(error));
        const errWithCode = error as { code?: number; message?: string };

        // Check for rate limit error (403 with rateLimitExceeded message)
        const isRateLimited =
          errWithCode.code === 403 &&
          errWithCode.message?.includes("rateLimitExceeded");

        if (isRateLimited && attempt < maxRetries) {
          // Exponential backoff: 1-2s, 2-4s, 4-8s
          const baseDelay = Math.pow(2, attempt) * 1000;
          const jitter = Math.random() * baseDelay;
          const delay = baseDelay + jitter;
          console.warn(
            `Rate limited, retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
    }

    // This should never be reached, but satisfies TypeScript
    throw lastError ?? new Error("Max retries exceeded");
  });
}
```

**Add to package.json:**

```json
"dependencies": {
  "bottleneck": "^2.19.5",
  "googleapis": "^130.0.0"
}
```

### File Streaming

Google Drive provides direct download via `files.get` with `alt=media`.

**Streaming Strategy:**

| Method                | Use Case                    | Range Support          |
| --------------------- | --------------------------- | ---------------------- |
| `files.get?alt=media` | Primary download            | Yes (via Range header) |
| `webContentLink`      | Direct URL for files <100MB | Yes (standard HTTP)    |
| Proxy through API     | Large files, auth required  | Yes                    |

**Helper Functions:**

```typescript
// lib/google-drive-actions.ts

// Get file with connection, validating user ownership
async function getFileWithConnection(fileId: string, userId: string) {
  const file = await prisma.itemFile.findUnique({
    where: { id: fileId },
    include: {
      item: {
        include: {
          connection: true,
        },
      },
    },
  });

  // Validate user owns this file
  if (!file || file.item.userId !== userId) {
    return null;
  }

  return file;
}

// Get connection by ID, validating user ownership
async function getConnection(connectionId: string, userId: string) {
  return prisma.googleDriveConnection.findFirst({
    where: { id: connectionId, userId },
  });
}
```

**Artwork Route:**

```typescript
// app/api/artwork/[fileId]/route.ts
import { auth } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { fileId: string } }
) {
  // Authenticate user
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get file with ownership validation
  const file = await getFileWithConnection(params.fileId, session.user.id);

  if (!file?.item?.connection) {
    return new Response("Not found", { status: 404 });
  }

  if (file.item.connection.needsReauth) {
    return new Response("Reconnect Google Drive", { status: 401 });
  }

  try {
    const drive = await getDriveClient(file.item.connection);

    const response = await drive.files.get(
      {
        fileId: file.driveFileId,
        alt: "media",
      },
      { responseType: "stream" }
    );

    return new Response(response.data as ReadableStream, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: unknown) {
    console.error("Artwork fetch error:", error);
    return new Response("Failed to fetch artwork", { status: 500 });
  }
}
```

**Video Streaming with Range Support:**

```typescript
// app/api/stream/[fileId]/route.ts
import { auth } from "@/lib/auth";

// Parse and validate Range header
function parseRangeHeader(
  range: string,
  fileSize: number
): { start: number; end: number } | null {
  // Must start with "bytes="
  if (!range.startsWith("bytes=")) {
    return null;
  }

  const rangeValue = range.slice(6); // Remove "bytes="
  const [startStr, endStr] = rangeValue.split("-");

  const start = parseInt(startStr, 10);

  // Validate start is a number and within bounds
  if (isNaN(start) || start < 0 || start >= fileSize) {
    return null;
  }

  // Parse end, default to 10MB chunk or end of file
  let end: number;
  if (endStr && endStr.length > 0) {
    end = parseInt(endStr, 10);
    if (isNaN(end) || end < start) {
      return null;
    }
  } else {
    end = Math.min(start + 10 * 1024 * 1024 - 1, fileSize - 1); // 10MB chunks
  }

  // Clamp end to file size
  end = Math.min(end, fileSize - 1);

  return { start, end };
}

export async function GET(
  req: Request,
  { params }: { params: { fileId: string } }
) {
  // Authenticate user
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get file with ownership validation
    const file = await getFileWithConnection(params.fileId, session.user.id);

    if (!file?.item?.connection) {
      return new Response("Not found", { status: 404 });
    }

    // Check if user needs to reconnect
    if (file.item.connection.needsReauth) {
      return new Response(
        "Authorization expired - please reconnect Google Drive",
        { status: 401 }
      );
    }

    const drive = await getDriveClient(file.item.connection);
    const fileSize = Number(file.size) || 0;

    const range = req.headers.get("range");
    if (range && fileSize > 0) {
      const parsed = parseRangeHeader(range, fileSize);

      if (!parsed) {
        return new Response("Invalid Range header", { status: 416 });
      }

      const { start, end } = parsed;

      const response = await drive.files.get(
        {
          fileId: file.driveFileId,
          alt: "media",
        },
        {
          responseType: "stream",
          headers: { Range: `bytes=${start}-${end}` },
        }
      );

      return new Response(response.data as ReadableStream, {
        status: 206,
        headers: {
          "Content-Type": file.mimeType || "video/mp4",
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
        },
      });
    }

    // Full file download (no range)
    const response = await drive.files.get(
      {
        fileId: file.driveFileId,
        alt: "media",
      },
      { responseType: "stream" }
    );

    return new Response(response.data as ReadableStream, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };

    if (err.code === 401 || err.message?.includes("reauth")) {
      return new Response(
        "Authorization expired - please reconnect Google Drive",
        { status: 401 }
      );
    }
    if (err.code === 404) {
      return new Response("File not found in Google Drive", { status: 404 });
    }
    if (err.code === 403) {
      return new Response("Access denied to file", { status: 403 });
    }

    console.error("Stream error:", error);
    return new Response("Failed to stream file", { status: 500 });
  }
}
```

**Fallback Strategy for Range Headers:**

Google Drive API supports Range headers via the `headers` option in `files.get`. If issues arise:

1. **Files under 100MB**: Use `webContentLink` for direct browser download (store URL in ItemFile)
2. **Files over 100MB**: Proxy through API with chunked streaming as implemented above
3. **Store metadata**: Add `webContentLink` field to ItemFile schema for direct access optimization

### Sync Badges

Items display status badges based on their `syncStatus` field:

| Status  | Badge | Appearance                        |
| ------- | ----- | --------------------------------- |
| SYNCED  | None  | Clean, no indicator               |
| SYNCING | 🔄    | Spinning loader                   |
| PENDING | ●     | Small dot indicator               |
| ERROR   | ⚠️    | Warning icon (clickable to retry) |

**Implementation:**

```typescript
// components/items/sync-badge.tsx
export function SyncBadge({ item }: { item: Item }) {
  if (item.syncStatus === 'SYNCED') return null

  if (item.syncStatus === 'SYNCING') {
    return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
  }

  if (item.syncStatus === 'PENDING') {
    return (
      <Tooltip content="Waiting to sync">
        <Circle className="h-2 w-2 fill-current text-muted-foreground" />
      </Tooltip>
    )
  }

  if (item.syncStatus === 'ERROR') {
    return (
      <Tooltip content={item.syncError || 'Sync failed. Click to retry.'}>
        <button onClick={() => retrySyncItem(item.id)}>
          <AlertTriangle className="h-3 w-3 text-destructive" />
        </button>
      </Tooltip>
    )
  }

  return null
}
```

**Usage in Grid/Tree:**

```tsx
// In GridItem.tsx / TreeItem.tsx
<div className="flex items-center gap-1">
  <span>{item.name}</span>
  <SyncBadge item={item} />
</div>
```

**Design rationale:**

- No badge when synced = clean UI (99% of the time)
- Only show indicators for actionable states
- Error badge is clickable for retry

### Sync Modal

A modal dialog shows sync progress and errors during manual sync operations.

**Design:**

```
┌─────────────────────────────────────────┐
│  Syncing with Google Drive         ✕    │
├─────────────────────────────────────────┤
│                                         │
│  ████████████░░░░░░░░  12/20 items      │
│                                         │
│  ↑ Creating: New Movie Folder           │
│  ↓ Importing: vacation-photos/img1.jpg  │
│                                         │
│  ────────────────────────────────────── │
│                                         │
│  ⚠️ 1 error                       [▼]   │
│  └ Failed to upload poster.jpg:         │
│    File too large (max 5GB)             │
│                                         │
├─────────────────────────────────────────┤
│                              [Close]    │
└─────────────────────────────────────────┘
```

**Features:**

- Progress bar with item count
- Current upload/download activity
- Expandable error list
- Stays open until complete (or user closes)
- Close button available anytime

**State management:**

```typescript
interface SyncModalState {
  isOpen: boolean;
  phase: "idle" | "pulling" | "pushing" | "complete";
  progress: {
    current: number;
    total: number;
  };
  currentAction?: string; // "Creating: Movie Folder"
  errors: Array<{
    itemName: string;
    error: string;
  }>;
}
```

**Triggers:**

- "Sync" button click → opens modal immediately
- Auto-sync on connect → shows modal
- Background/periodic sync → toast only (no modal)

**Implementation:**

```typescript
// components/google-drive/sync-modal.tsx
export function SyncModal() {
  const { state, close } = useSyncModal()

  return (
    <Dialog open={state.isOpen} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Syncing with Google Drive</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Progress value={(state.progress.current / state.progress.total) * 100} />
          <p className="text-sm text-muted-foreground">
            {state.progress.current}/{state.progress.total} items
          </p>

          {state.currentAction && (
            <p className="text-sm">{state.currentAction}</p>
          )}

          {state.errors.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {state.errors.length} error(s)
              </CollapsibleTrigger>
              <CollapsibleContent>
                {state.errors.map((err, i) => (
                  <div key={i} className="text-sm text-destructive">
                    {err.itemName}: {err.error}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {state.phase === 'complete' ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Upload Modal

A modal dialog for uploading files to an item with progress tracking.

**Design:**

```
┌─────────────────────────────────────────┐
│  Upload Files to "Movie Name"      ✕    │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │   Drop files here or click     │    │
│  │         to browse              │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Uploading 2 of 3 files...              │
│  ████████████░░░░░░░░  2.4 GB / 4.1 GB  │
│                                         │
│  ✓ poster.jpg                    2.1 MB │
│  ✓ backdrop.png                  4.3 MB │
│  ↑ movie.mkv                     4.1 GB │
│    ████████░░░░░░  58%                  │
│                                         │
│  ⚠️ trailer.mp4 - Failed (retry)        │
│                                         │
├─────────────────────────────────────────┤
│  [Cancel]                      [Done]   │
└─────────────────────────────────────────┘
```

**Features:**

- Drag-and-drop zone
- Multiple file selection
- Per-file progress bars
- Overall progress
- Retry failed uploads
- Cancel individual or all uploads
- Auto-detects file type (MEDIA, ARTWORK, SUBTITLE)

**Upload button location:**

- Only on item detail pages (`/my-items/[itemId]`)
- Uploads to current item's folder
- Not on root page (user navigates to item first)

**Upload strategy by file size:**

| File Size | Upload Type | Why                   |
| --------- | ----------- | --------------------- |
| ≤ 5 MB    | Multipart   | Fast, single request  |
| > 5 MB    | Resumable   | Can resume on failure |

**State management:**

```typescript
interface UploadModalState {
  isOpen: boolean;
  itemId: string;
  itemName: string;
  files: Array<{
    id: string;
    file: File;
    status: "pending" | "uploading" | "complete" | "error";
    progress: number; // 0-100
    error?: string;
  }>;
  overallProgress: {
    uploaded: number;
    total: number;
  };
}
```

**Resumable upload implementation:**

```typescript
interface UploadSession {
  uploadUri: string;
  fileId?: string;
  uploaded: number;
  fileSize: number;
}

// Store upload sessions for resume capability
const uploadSessions = new Map<string, UploadSession>();

async function uploadLargeFile(
  drive: drive_v3.Drive,
  file: File,
  parentFolderId: string,
  onProgress: (percent: number) => void,
  sessionKey?: string // For resuming interrupted uploads
): Promise<string> {
  const chunkSize = 5 * 1024 * 1024; // 5MB chunks (Google minimum for resumable)
  const maxRetries = 3;

  let session: UploadSession;

  // Check for existing session to resume
  if (sessionKey && uploadSessions.has(sessionKey)) {
    session = uploadSessions.get(sessionKey)!;

    // Query Google for actual upload progress
    try {
      const statusResponse = await fetch(session.uploadUri, {
        method: "PUT",
        headers: { "Content-Range": `bytes */${file.size}` },
      });

      if (statusResponse.status === 308) {
        // Upload incomplete - parse Range header for progress
        const range = statusResponse.headers.get("Range");
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          session.uploaded = match ? parseInt(match[1], 10) + 1 : 0;
        }
      } else if (statusResponse.ok) {
        // Upload already complete
        const data = await statusResponse.json();
        uploadSessions.delete(sessionKey);
        return data.id;
      }
    } catch {
      // Session expired, start fresh
      uploadSessions.delete(sessionKey);
      session = await initiateUploadSession(drive, file, parentFolderId);
    }
  } else {
    // Start new upload session
    session = await initiateUploadSession(drive, file, parentFolderId);
  }

  // Store session for potential resume
  const newSessionKey = sessionKey || `${file.name}-${Date.now()}`;
  uploadSessions.set(newSessionKey, session);

  // Upload in chunks with retry logic
  while (session.uploaded < file.size) {
    const start = session.uploaded;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(session.uploadUri, {
          method: "PUT",
          headers: {
            "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
            "Content-Type": file.type || "application/octet-stream",
          },
          body: chunk,
        });

        if (response.status === 308) {
          // Chunk uploaded, continue
          session.uploaded = end;
          onProgress(Math.round((session.uploaded / file.size) * 100));
          break;
        } else if (response.ok) {
          // Upload complete
          const data = await response.json();
          uploadSessions.delete(newSessionKey);
          onProgress(100);
          return data.id;
        } else if (response.status >= 500) {
          // Server error - retry with backoff
          lastError = new Error(`Server error: ${response.status}`);
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
          continue;
        } else {
          // Client error - don't retry
          throw new Error(
            `Upload failed: ${response.status} ${await response.text()}`
          );
        }
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === maxRetries - 1) {
          // Store progress for later resume
          uploadSessions.set(newSessionKey, session);
          throw new Error(
            `Upload failed after ${maxRetries} retries: ${lastError.message}. Session saved for resume.`
          );
        }
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw new Error("Upload completed without file ID");
}

async function initiateUploadSession(
  drive: drive_v3.Drive,
  file: File,
  parentFolderId: string
): Promise<UploadSession> {
  // Initiate resumable upload session
  const initResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getAccessToken(drive)}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify({
        name: file.name,
        parents: [parentFolderId],
      }),
    }
  );

  if (!initResponse.ok) {
    throw new Error(`Failed to initiate upload: ${initResponse.status}`);
  }

  const uploadUri = initResponse.headers.get("Location");
  if (!uploadUri) {
    throw new Error("No upload URI returned from Google");
  }

  return {
    uploadUri,
    uploaded: 0,
    fileSize: file.size,
  };
}

// Helper to get access token from drive client
async function getAccessToken(drive: drive_v3.Drive): Promise<string> {
  const credentials = await drive.context._options.auth.getAccessToken();
  return credentials.token || "";
}

// Cancel an in-progress upload
async function cancelUpload(sessionKey: string): Promise<void> {
  const session = uploadSessions.get(sessionKey);
  if (session) {
    try {
      await fetch(session.uploadUri, { method: "DELETE" });
    } catch {
      // Ignore errors on cancel
    }
    uploadSessions.delete(sessionKey);
  }
}
```

## File Inventory

### Files to Delete (~35)

**Core lib:**

- `lib/sftp-actions.ts` (1,477 lines)
- `lib/sftp-client.ts` (295 lines)
- `lib/sftp-utils.ts` (106 lines)
- `lib/webdav-utils.ts`

**Components:**

- `components/sftp/connection-card.tsx`
- `components/sftp/connection-form.tsx`
- `components/sftp/connection-test-button.tsx`
- `components/sftp/sync-button.tsx`
- `components/sftp/sync-all-button.tsx`
- `components/sftp/item-sync-button.tsx`
- `components/sftp/index.ts`

**API routes:**

- `app/api/sftp/download/file/[fileId]/route.ts`

**E2E infrastructure:**

- `e2e/docker-compose.yml`
- `e2e/fixtures/sftp.fixture.ts`
- `e2e/journeys/sftp/sftp-sync.spec.ts`
- `e2e/journeys/sftp/sftp-server-to-web.spec.ts`
- `e2e/journeys/sftp/sftp-web-to-server.spec.ts`

**Tests:**

- `tests/unit/lib/sftp-actions.test.ts`
- `tests/unit/lib/sftp-actions-sync-all.test.ts`
- `tests/unit/lib/sftp-client.test.ts`
- `tests/unit/lib/sftp-utils.test.ts`
- `tests/unit/lib/webdav-utils.test.ts`
- `tests/unit/components/sftp/*.test.tsx` (4 files)
- `tests/unit/e2e/sftp-fixture.test.ts`
- `tests/unit/prisma/seed-upload.test.ts`
- `tests/integration/sftp/sftp-connection.test.ts`
- `tests/integration/sftp/circuit-breaker.test.ts`

**Seed utils:**

- `prisma/seed-utils.ts`

### Files to Create (~20)

**Core lib:**

- `lib/google-drive-client.ts` - OAuth client, token refresh, rate limiting
- `lib/google-drive-actions.ts` - Sync logic, connection CRUD, file upload

**Components:**

- `components/google-drive/connection-card.tsx`
- `components/google-drive/connect-button.tsx`
- `components/google-drive/sync-button.tsx`
- `components/google-drive/sync-all-button.tsx`
- `components/google-drive/sync-modal.tsx` - Progress/error modal
- `components/google-drive/index.ts`
- `components/items/sync-badge.tsx` - Status badge (syncing/pending/error)
- `components/items/file-upload-button.tsx` - Upload files to item
- `components/items/file-upload-modal.tsx` - Upload modal with drag-drop and progress

**Hooks:**

- `hooks/use-sync-modal.ts` - Sync modal state management
- `hooks/use-file-upload.ts` - File upload state management

**API routes:**

- `app/api/auth/callback/google/route.ts` - OAuth callback handler

**E2E:**

- `e2e/fixtures/google-drive.fixture.ts`
- `e2e/journeys/google-drive/connect.spec.ts`
- `e2e/journeys/google-drive/sync.spec.ts`

**Tests:**

- `tests/unit/lib/google-drive-actions.test.ts`
- `tests/unit/lib/google-drive-client.test.ts`
- `tests/integration/google-drive/sync.test.ts`

### Files to Update (~25)

**Database:**

- `prisma/schema.prisma`

**Seed:**

- `prisma/seed.ts`
- `prisma/seed-data.ts` (keep as-is)
- `scripts/check-seed-items.ts`

**Pages:**

- `app/(my-items)/my-items/connections/page.tsx`
- `app/(my-items)/my-items/connections/new/page.tsx`
- `app/(my-items)/my-items/connections/[id]/edit/page.tsx`

**API routes:**

- `app/api/artwork/[fileId]/route.ts`
- `app/api/stream/[fileId]/route.ts`

**Components:**

- `components/items/items-toolbar.tsx`
- `components/items/items-view.tsx`
- `components/items/filtered-items-view.tsx`
- `components/items/connection-filter.tsx`
- `components/items/item-detail-client.tsx`
- `components/sortable-tree/*.tsx`
- `components/sortable-grid/*.tsx`

**Lib:**

- `lib/item-actions.ts`
- `lib/item-file-actions.ts`
- `lib/item-utils.ts`
- `lib/types.ts`
- `lib/validations.ts`
- `lib/rate-limit.ts`
- `lib/env.ts`

**Config:**

- `package.json`
- `CLAUDE.md`

**Documentation:**

- `content/docs/connections/setup-connection.mdx`
- `content/docs/connections/sync-items.mdx`
- `content/docs/connections/media-playback.mdx`
- `content/docs/connections/manage-items.mdx`
- `content/docs/getting-started/quick-tour.mdx`
- `content/docs/index.mdx`

## Environment Variables

### Remove

```bash
SFTP_SEED_HOST
SFTP_SEED_PORT
SFTP_SEED_USERNAME
SFTP_SEED_PASSWORD
SFTP_SEED_BASE_PATH
SFTP_SEED_HTTPS_URL
```

### Add

```bash
# Google OAuth credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Seeding (for real seed data)
GOOGLE_SEED_REFRESH_TOKEN=1//0xxx...
GOOGLE_SEED_EMAIL=canoncore.seed@gmail.com
```

### Keep

```bash
ENCRYPTION_KEY=xxx  # Still encrypts OAuth tokens
SEED_PASSWORD=xxx   # Still used for seed user passwords
ALLOW_SEEDING=true  # Still gates seeding
```

## Testing Strategy

### Unit Tests

Mock Google Drive API at the client level:

```typescript
// tests/unit/setup.ts
vi.mock("@/lib/google-drive-client", () => ({
  getDriveClient: vi.fn(() => ({
    files: {
      list: vi.fn(),
      get: vi.fn(),
    },
    changes: {
      list: vi.fn(),
      getStartPageToken: vi.fn(),
    },
  })),
  withRateLimit: vi.fn((fn) => fn()),
  refreshAccessToken: vi.fn(),
}));
```

### Integration Tests

Real database, mocked API:

```typescript
describe("Google Drive Sync", () => {
  it("creates items from Drive files", async () => {
    const connection = await createTestConnection();
    mockDrive.files.list.mockResolvedValue({
      data: {
        files: [{ id: "abc123", name: "Movie.mp4", mimeType: "video/mp4" }],
      },
    });

    await syncFromDrive(connection.id);

    const item = await prisma.item.findFirst({
      where: { connectionId: connection.id, driveFileId: "abc123" },
    });
    expect(item).toBeDefined();
    expect(item.name).toBe("Movie.mp4");
  });

  it("updates existing items on rename (no duplicates)", async () => {
    const connection = await createTestConnection();
    await prisma.item.create({
      data: {
        connectionId: connection.id,
        driveFileId: "abc123",
        name: "Old Name",
        userId: connection.userId,
      },
    });

    mockDrive.files.list.mockResolvedValue({
      data: { files: [{ id: "abc123", name: "New Name" }] },
    });

    await syncFromDrive(connection.id);

    const items = await prisma.item.findMany({
      where: { connectionId: connection.id, driveFileId: "abc123" },
    });
    expect(items).toHaveLength(1); // No duplicate!
    expect(items[0].name).toBe("New Name");
  });

  it("handles page token expiry with full sync fallback", async () => {
    const connection = await createTestConnection();
    await prisma.googleDriveConnection.update({
      where: { id: connection.id },
      data: { changePageToken: "expired-token" },
    });

    mockDrive.changes.list.mockRejectedValue({ code: 404 });
    mockDrive.changes.getStartPageToken.mockResolvedValue({
      data: { startPageToken: "new-token" },
    });
    mockDrive.files.list.mockResolvedValue({ data: { files: [] } });

    await incrementalSync(connection);

    // Should have called full sync
    expect(mockDrive.files.list).toHaveBeenCalled();
  });
});
```

### E2E Tests

Mock OAuth and API at network level (no Docker needed):

```typescript
// e2e/fixtures/google-drive.fixture.ts
import { test as base } from "@playwright/test";

interface MockDrive {
  setFiles(files: Array<{ id: string; name: string; mimeType?: string }>): void;
  setChanges(changes: Array<{ fileId: string; removed?: boolean }>): void;
}

export const test = base.extend<{ mockDrive: MockDrive }>({
  mockDrive: async ({ page }, use) => {
    let mockFiles: any[] = [];
    let mockChanges: any[] = [];

    // Intercept Google OAuth - redirect back immediately with mock code
    await page.route("**/accounts.google.com/**", (route) => {
      const url = new URL(route.request().url());
      const redirectUri = url.searchParams.get("redirect_uri");
      route.fulfill({
        status: 302,
        headers: { Location: `${redirectUri}?code=mock-auth-code` },
      });
    });

    // Intercept token exchange
    await page.route("**/oauth2.googleapis.com/token", (route) => {
      route.fulfill({
        json: {
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
        },
      });
    });

    // Intercept Drive API calls
    await page.route("**/googleapis.com/drive/v3/files**", (route) => {
      route.fulfill({ json: { files: mockFiles } });
    });

    await page.route("**/googleapis.com/drive/v3/changes**", (route) => {
      route.fulfill({
        json: {
          changes: mockChanges,
          newStartPageToken: "new-token",
        },
      });
    });

    const mockDrive: MockDrive = {
      setFiles: (files) => {
        mockFiles = files;
      },
      setChanges: (changes) => {
        mockChanges = changes;
      },
    };

    await use(mockDrive);
  },
});
```

```typescript
// e2e/journeys/google-drive/connect.spec.ts
import { test, expect } from "../../fixtures/google-drive.fixture";

test("user can connect Google Drive via OAuth", async ({ page, mockDrive }) => {
  await page.goto("/my-items/connections");
  await page.click("text=Connect Google Drive");

  // OAuth flow is mocked - redirects back immediately
  await expect(page.locator("text=My Google Drive")).toBeVisible();
});

test("sync imports files from Drive", async ({ page, mockDrive }) => {
  mockDrive.setFiles([
    {
      id: "folder1",
      name: "Movies",
      mimeType: "application/vnd.google-apps.folder",
    },
    { id: "file1", name: "Inception.mp4", mimeType: "video/mp4" },
  ]);

  await page.goto("/my-items/connections");
  await page.click("text=Sync");
  await expect(page.locator("text=Synced")).toBeVisible();

  await page.goto("/my-items");
  await expect(page.locator("text=Movies")).toBeVisible();
  await expect(page.locator("text=Inception.mp4")).toBeVisible();
});
```

## Seeding Strategy

Seeding uses a real Google Drive account with actual files for full functionality:

```typescript
// prisma/seed.ts
async function createSeedConnection(userId: string): Promise<string> {
  const { encryptCredential } = await import("@/lib/crypto");

  const refreshToken = process.env.GOOGLE_SEED_REFRESH_TOKEN;
  const email = process.env.GOOGLE_SEED_EMAIL;

  if (!refreshToken || !email) {
    console.log(
      "  ⚠️  No GOOGLE_SEED_REFRESH_TOKEN - skipping Drive connection"
    );
    return null;
  }

  // Get access token and root folder ID from the seed account
  const { accessToken, rootFolderId } =
    await initializeSeedConnection(refreshToken);

  const connection = await prisma.googleDriveConnection.upsert({
    where: { userId_email: { userId, email } },
    update: {
      encryptedRefreshToken: encryptCredential(refreshToken),
      encryptedAccessToken: encryptCredential(accessToken),
      accessTokenExpiry: new Date(Date.now() + 3600000),
    },
    create: {
      userId,
      name: "Seed Media Library",
      email,
      encryptedRefreshToken: encryptCredential(refreshToken),
      encryptedAccessToken: encryptCredential(accessToken),
      accessTokenExpiry: new Date(Date.now() + 3600000),
      rootFolderId,
      isActive: true,
      needsReauth: false,
    },
  });

  console.log(`  ✓ Created Google Drive connection: ${connection.name}`);
  return connection.id;
}

async function seedFromDrive(connectionId: string, userId: string) {
  // Sync items from the seed Google Drive
  // This imports the folder structure + files with real driveFileIds
  const result = await syncFromDrive(connectionId);
  console.log(`  ✓ Synced ${result.itemsCreated} items from Google Drive`);

  // Apply ALL curated metadata from seed-data.ts
  await applySeedMetadata(userId);
}

async function applySeedMetadata(userId: string) {
  // Import seed data definitions (same format as current seed-data.ts)
  const { SEED_ITEMS } = await import("./seed-data");

  for (const seedItem of SEED_ITEMS) {
    // Find the synced item by name
    const item = await prisma.item.findFirst({
      where: { userId, name: seedItem.name },
      include: { files: true },
    });

    if (!item) continue;

    // Apply item metadata
    await prisma.item.update({
      where: { id: item.id },
      data: {
        description: seedItem.description,
        order: seedItem.order,
        // depth comes from sync, but order is curated
      },
    });

    // Apply file metadata (primary, hero, etc.)
    if (seedItem.files) {
      for (const seedFile of seedItem.files) {
        // Match by filename
        const file = item.files.find((f) => f.filename === seedFile.filename);
        if (file) {
          await prisma.itemFile.update({
            where: { id: file.id },
            data: {
              isPrimary: seedFile.isPrimary ?? false,
              isHero: seedFile.isHero ?? false,
            },
          });
        }
      }
    }

    // Recurse for children
    if (seedItem.children) {
      await applySeedMetadataRecursive(userId, item.id, seedItem.children);
    }
  }
}

async function applySeedMetadataRecursive(
  userId: string,
  parentId: string,
  seedChildren: SeedItem[]
) {
  for (const seedChild of seedChildren) {
    const item = await prisma.item.findFirst({
      where: { userId, parentId, name: seedChild.name },
      include: { files: true },
    });

    if (!item) continue;

    await prisma.item.update({
      where: { id: item.id },
      data: {
        description: seedChild.description,
        order: seedChild.order,
      },
    });

    // Apply file metadata
    if (seedChild.files) {
      for (const seedFile of seedChild.files) {
        const file = item.files.find((f) => f.filename === seedFile.filename);
        if (file) {
          await prisma.itemFile.update({
            where: { id: file.id },
            data: {
              isPrimary: seedFile.isPrimary ?? false,
              isHero: seedFile.isHero ?? false,
            },
          });
        }
      }
    }

    if (seedChild.children) {
      await applySeedMetadataRecursive(userId, item.id, seedChild.children);
    }
  }
}
```

**Seed workflow:**

1. Create seed users
2. Create GoogleDriveConnection using `GOOGLE_SEED_REFRESH_TOKEN`
3. Sync from Drive → imports folder structure + files with real `driveFileId`s
4. Apply ALL metadata from `seed-data.ts`:
   - Item descriptions
   - Item order (display order in UI)
   - Primary file selection (which file plays by default)
   - Hero artwork selection (which image shows in hero banner)

**Environment variables required:**

```bash
GOOGLE_SEED_REFRESH_TOKEN=1//0xxx...
GOOGLE_SEED_EMAIL=canoncore.seed@gmail.com
```

**Seed Data Notes:**

- Real `driveFileId` values from actual Google Drive files
- Artwork/streaming works fully ✓
- `seed-data.ts` format stays the same - just matches by name instead of creating
- Folder names in Google Drive must match `seed-data.ts` item names exactly

## Phase 0: Pre-Implementation Setup

Complete these tasks before starting implementation:

### Google Cloud Setup

- [x] Create Google Cloud Project at [console.cloud.google.com](https://console.cloud.google.com)
- [x] Enable Google Drive API in APIs & Services
- [x] Configure OAuth consent screen:
  - Select "External" user type
  - App name: "CanonCore"
  - Add scope: `https://www.googleapis.com/auth/drive.file`
  - Add test user emails (up to 100 during development)
- [x] Create OAuth 2.0 Client ID:
  - Application type: Web application
  - Authorized redirect URIs:
    - `http://localhost:3000/api/auth/callback/google-drive` (dev)
    - `https://canoncore.com/api/auth/callback/google-drive` (prod)
  - Copy Client ID and Client Secret

### Environment Variables

- [x] Add to `.env.local`:

```bash
GOOGLE_CLIENT_ID=574274989442-pmentq1ao18t65q93754pbsl77mcb4u6.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
```

### Seeding Setup (Real Files)

Use a dedicated Google account for seed data with real files:

**1. Create seed Google account**

- Create or use existing Google account for seed data (e.g., `canoncore.seed@gmail.com`)
- This account will hold all seed-media files

**2. Upload seed-media to Google Drive**

- Sign into the seed Google account
- Implement Phase 1 first (OAuth flow)
- Connect the seed account via CanonCore → creates "CanonCore" folder
- Upload `seed-media/*` contents to the "CanonCore" folder in Drive
- Or: Upload directly to Drive, then move into "CanonCore" folder

**3. Get refresh token for seeding**

- After connecting, copy the refresh token from database
- Or: Add a dev endpoint to display the token
- Store as `GOOGLE_SEED_REFRESH_TOKEN` in `.env.local`

**4. Environment variables for seeding**

```bash
GOOGLE_SEED_REFRESH_TOKEN=1//0xxx...  # From connected seed account
GOOGLE_SEED_EMAIL=canoncore.seed@gmail.com
```

### Privacy Policy

Required for Google app verification:

- [x] Create `/privacy-policy` page
- [x] Explain what data is accessed (file names, IDs, folder structure)
- [x] Explain storage (encrypted tokens in database)
- [x] Explain data retention and deletion

### Timeline Note

The `drive.file` scope is NOT classified as sensitive, so verification should be faster than `drive.readonly`. During development:

- Use test users (up to 100)
- Users may see "This app isn't verified" warning initially
- Click "Advanced > Go to CanonCore (unsafe)" to proceed

## Implementation Phases

### Phase 1: Core Infrastructure

- [x] Create `lib/google-drive-client.ts` (OAuth, token refresh, rate limiting)
- [x] Create `lib/google-drive-actions.ts` (sync logic)
- [x] Add OAuth callback route `app/api/auth/callback/google-drive/route.ts`
- [x] Run database migration (new schema)
- [x] Update `prisma/schema.prisma`
- [x] Add `googleapis` and `bottleneck` to package.json

### Phase 2: UI Components

- [ ] Create `components/google-drive/connect-button.tsx`
- [ ] Create `components/google-drive/connection-card.tsx`
- [ ] Create `components/google-drive/sync-button.tsx`
- [ ] Create `components/google-drive/sync-all-button.tsx`
- [ ] Create `components/google-drive/sync-modal.tsx`
- [ ] Create `hooks/use-sync-modal.ts`
- [ ] Create `components/items/sync-badge.tsx`
- [ ] Create `components/items/file-upload-button.tsx`
- [ ] Create `components/items/file-upload-modal.tsx`
- [ ] Create `hooks/use-file-upload.ts`
- [ ] Add sync badge to `GridItem.tsx` and `TreeItem.tsx`
- [ ] Add upload button to item detail page toolbar
- [ ] Update connection pages for OAuth flow
- [ ] Update `items-toolbar.tsx` imports

### Phase 3: File Access (Complete)

- [x] Update `app/api/artwork/[fileId]/route.ts` (Google Drive + SFTP fallback)
- [x] Update `app/api/stream/[fileId]/route.ts` (Google Drive + WebDAV fallback)
- [x] Verify Range header support (parseRangeHeader + Drive Range forwarding)
- [x] Delete `app/api/sftp/download/` route
- [x] Keep `lib/webdav-utils.ts` (needed for WebDAV fallback - deferred to Phase 4)

### Phase 4: Cleanup SFTP

- [ ] Delete `lib/sftp-*.ts` files
- [ ] Delete `components/sftp/` directory
- [ ] Delete `e2e/docker-compose.yml`
- [ ] Delete `e2e/fixtures/sftp.fixture.ts`
- [ ] Update `e2e/journeys/global.setup.ts` (remove Docker)
- [ ] Update `e2e/journeys/global.teardown.ts` (remove Docker)
- [ ] Remove `ssh2-sftp-client` from package.json

### Phase 5: Testing

- [ ] Create `e2e/fixtures/google-drive.fixture.ts`
- [ ] Write unit tests for google-drive-client
- [ ] Write unit tests for google-drive-actions
- [ ] Write integration tests for sync (bidirectional)
- [ ] Write E2E tests for OAuth + sync
- [ ] Delete all SFTP test files

### Phase 6: Documentation & Seeding

- [ ] Update `prisma/seed.ts` for mock Drive connections
- [ ] Rewrite `content/docs/connections/setup-connection.mdx`
- [ ] Rewrite `content/docs/connections/sync-items.mdx`
- [ ] Update `content/docs/connections/media-playback.mdx`
- [ ] Update `CLAUDE.md`

## Deployment Checklist

### Pre-deployment (Google Cloud Setup)

1. **Create Google Cloud Project**
   - [x] Go to [Google Cloud Console](https://console.cloud.google.com)
   - [x] Create new project or select existing
   - [x] Enable Google Drive API

2. **Configure OAuth Consent Screen**
   - [x] Go to APIs & Services > OAuth consent screen
   - [x] Select "External" user type
   - [x] Fill in app name, support email, developer email
   - [x] Add scope: `https://www.googleapis.com/auth/drive.file`
   - [x] Add test users (for development before verification)

3. **Create OAuth Credentials**
   - [x] Go to APIs & Services > Credentials
   - [x] Create OAuth 2.0 Client ID (Web application)
   - [x] Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google-drive` (dev)
     - `https://canoncore.com/api/auth/callback/google-drive` (prod)
   - [x] Copy Client ID and Client Secret

4. **Submit for Verification** (if needed)
   - [x] `drive.file` scope is NOT sensitive - verification may be simpler/faster
   - [x] Prepare privacy policy URL (`/privacy-policy` created)
   - [ ] Submit for Google review if required

### Phase 1: Core Infrastructure (Complete)

- [x] Create `lib/google-drive-client.ts` (OAuth, token refresh, rate limiting)
- [x] Create `lib/google-drive-actions.ts` (server actions for Drive operations)
- [x] Create `app/api/auth/callback/google-drive/route.ts` (OAuth callback)
- [x] Update `prisma/schema.prisma` (GoogleDriveConnection, SyncStatus, Item/ItemFile fields)
- [x] Run database migration (`npx prisma db push`)
- [x] Add `googleapis` and `bottleneck` to package.json
- [x] Fix type errors in sftp-actions.ts, item-actions.ts (object spread pattern)
- [x] Add null checks for sftpPath in API routes (artwork, stream, download)
- [x] Update test mock data with Google Drive fields
- [x] Code review completed (no blocking issues)

### Phase 2: UI Components (Complete)

- [x] Create `components/items/sync-badge.tsx` (SyncBadge, SyncIcon components)
- [x] Create `components/google-drive/connect-button.tsx` (OAuth flow initiation)
- [x] Create `components/google-drive/connection-card.tsx` (quota, status, actions)
- [x] Create `components/google-drive/sync-button.tsx` (per-item sync trigger)
- [x] Create `components/google-drive/index.ts` (barrel export)
- [x] Update `components/sortable-grid/GridItem.tsx` (syncStatus prop, SyncIcon display)
- [x] Update `components/sortable-tree/components/TreeItem/TreeItem.tsx` (syncStatus prop)
- [x] Update `app/(my-items)/my-items/connections/page.tsx` (dual SFTP/Drive sections)
- [x] Update `components/items/index.ts` (export SyncBadge, SyncIcon)
- [x] Add shadcn/ui Progress component
- [x] Type-check and lint pass
- [x] Code review completed (no blocking issues)

### Phase 3: File Access (Complete)

- [x] Update `app/api/artwork/[fileId]/route.ts` (Google Drive + SFTP fallback)
- [x] Update `app/api/stream/[fileId]/route.ts` (Google Drive + WebDAV fallback)
- [x] Implement `parseRangeHeader()` for HTTP Range request parsing
- [x] Delete `app/api/sftp/download/` route (unused)
- [x] Keep `lib/webdav-utils.ts` (needed for WebDAV fallback until Phase 4)
- [x] Clear `.next` cache after route deletion
- [x] Type-check and lint pass
- [x] Build passes

### Environment Variables

- [ ] Add `GOOGLE_CLIENT_ID` to Vercel (production)
- [ ] Add `GOOGLE_CLIENT_SECRET` to Vercel (production)
- [ ] Add `GOOGLE_REDIRECT_URI` to Vercel (production URL)
- [x] Verify `ENCRYPTION_KEY` is set
- [x] Add `GOOGLE_CLIENT_ID` to `.env.local` (development)
- [x] Add `GOOGLE_CLIENT_SECRET` to `.env.local` (development)

### Deployment

- [ ] Merge PR to development
- [ ] Run `npx prisma migrate deploy`
- [ ] Test OAuth flow on preview deployment
- [ ] Verify sync creates items correctly
- [ ] Test media streaming with Range requests
- [ ] Test token refresh (wait 1 hour or manually expire)

### Post-deployment

- [ ] Remove `SFTP_SEED_*` env vars from Vercel
- [ ] Monitor for OAuth errors in logs
- [ ] Monitor for rate limit errors
- [ ] Update seed data for QA testing

## Risk Mitigation

| Risk                     | Mitigation                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Google API rate limits   | `bottleneck` rate limiter, exponential backoff on 403                                       |
| Token expiry during sync | Check expiry before each batch, refresh proactively                                         |
| User revokes access      | `needsReauth` flag, clear UI prompt to reconnect                                            |
| Large file timeout       | Streaming responses, chunked range requests                                                 |
| Page token expiry        | Fall back to full sync on 404 from changes.list                                             |
| API changes              | Version-pin `googleapis` package, monitor changelog                                         |
| Encryption key rotation  | Store key version with encrypted data; on rotation, re-encrypt lazily on next token refresh |
| Sync conflicts           | Last-write-wins with `driveModifiedAt` comparison; conflict detection UI (see below)        |
| Push failure             | Set `syncStatus: ERROR`, show badge, allow retry                                            |
| Project-level quota      | Per-user rate limiting ensures fair distribution; monitor in production                     |

### Sync Conflict Resolution

**Strategy: Last-Write-Wins with Notification**

When the same item is modified in both CanonCore and Google Drive between syncs:

1. **Detection**: Compare `driveModifiedAt` with local `updatedAt` timestamp
2. **Resolution**: Google Drive timestamp wins (source of truth for file content)
3. **Notification**: Show toast with option to view changes

**Implementation:**

```typescript
async function detectConflict(
  item: Item,
  driveFile: drive_v3.Schema$File
): Promise<boolean> {
  if (!item.driveModifiedAt || !driveFile.modifiedTime) {
    return false;
  }

  const driveModified = new Date(driveFile.modifiedTime);
  const localModified = item.updatedAt;

  // Conflict if both modified since last sync and times differ significantly
  const lastSync = item.driveModifiedAt;
  const driveChangedSinceSync = driveModified > lastSync;
  const localChangedSinceSync = localModified > lastSync;

  return driveChangedSinceSync && localChangedSinceSync;
}

async function resolveConflict(
  item: Item,
  driveFile: drive_v3.Schema$File
): Promise<{ resolved: "drive" | "local"; notification: string }> {
  // Drive wins for file content (it's the actual file storage)
  // Local metadata (order, description) is preserved

  await prisma.item.update({
    where: { id: item.id },
    data: {
      name: driveFile.name || item.name,
      driveModifiedAt: new Date(driveFile.modifiedTime!),
      syncStatus: "SYNCED",
      // Note: order, description preserved from local
    },
  });

  return {
    resolved: "drive",
    notification: `"${item.name}" was modified in both places. Google Drive version applied.`,
  };
}
```

**Conflict UI:**

```typescript
// components/items/conflict-toast.tsx
export function ConflictToast({ itemName, resolution }: ConflictToastProps) {
  return (
    <Toast>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <div>
          <p className="font-medium">Sync Conflict Resolved</p>
          <p className="text-sm text-muted-foreground">
            "{itemName}" was modified in both places. {resolution === 'drive' ? 'Google Drive' : 'Local'} version applied.
          </p>
        </div>
      </div>
    </Toast>
  )
}
```

## Capabilities Comparison

| Capability                | SFTP (Before)             | Google Drive (After)  |
| ------------------------- | ------------------------- | --------------------- |
| Folder rename detection   | Creates duplicates        | Updates in place      |
| File move detection       | Creates duplicates        | Updates parent        |
| File rename detection     | Creates duplicates        | Updates filename      |
| Incremental sync          | Full re-scan              | Change tokens         |
| **Bidirectional sync**    | ❌ Read-only              | ✅ Full read/write    |
| **Create from CanonCore** | ❌ Not supported          | ✅ Creates in Drive   |
| User setup                | Complex (host/port/creds) | OAuth click           |
| Streaming config          | Separate WebDAV           | Built-in              |
| Real-time sync            | Impossible                | Webhooks ready        |
| Rate limiting             | N/A                       | Built-in with backoff |
| **Sync status UI**        | None                      | Badges + Modal        |

## Validation Notes

This design was validated using:

- **code-review-excellence skill** for systematic review
- **Context7** for Google Drive API documentation
- **Sequential thinking** for issue identification (10 thoughts)

### Key Validations

- Google Drive API v3 enforces single-parent (matches our hierarchy model)
- `drive.file` scope allows full bidirectional sync without sensitive classification
- `drive.file` grants access to app-created files AND user-added files in app folders
- Range headers are supported for partial downloads
- Change page tokens expire after ~7 days of inactivity
- Sync badges + modal provide clear status feedback

### Issues Found & Fixed (Integrated Above)

All blocking issues discovered during validation have been fixed in their appropriate locations:

1. **Token refresh implementation** - Added to "Token Refresh Implementation" section after Token Management
2. **Folder tree filter** - Added `isFileInCanonCoreTree()` helper to `handleFileChanged` in Pull from Drive section
3. **Error handling in streaming** - Added try-catch with proper error responses to Video Streaming section
4. **Descendant depth updates** - Added `updateDescendantDepths()` helper to `moveItemWithDrive`
5. **Exponential backoff** - Enhanced `withRateLimit` with 3 retries and proper backoff in Rate Limiting section
6. **syncItemFile signature** - Removed unused `drive` parameter from function signature
7. **N+1 aggregate query** - Moved maxOrder query outside pagination loop in `syncFolder`
8. **Missing depth/order** - Added depth, order calculation and validation to `createItemWithDrive`
9. **Conflict detection integration** - Integrated `detectConflict` into `handleFileChanged` with UI notification collection
10. **startPageToken validation** - Added null check for `tokenResponse.data.startPageToken`
11. **Cache clearing** - Added `clearParentChainCache()` and `clearSyncConflicts()` calls at sync start
