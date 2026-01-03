# Media Library Model Design

**Date**: 2026-01-02

## Overview

Redesign CanonCore from a file browser into an SFTP media player. Items become containers that hold attached files (media, artwork, subtitles) rather than having files as separate navigable items.

## Core Concept

```
Current model:
📁 Folder
  📁 Subfolder
  📄 file1.mp4  ← file is a separate Item
  📄 file2.mp4  ← file is a separate Item

New model:
📁 Item (has files attached: file1.mp4, file2.mp4)
  📁 Child Item (can also have files attached)
```

- Items are always containers (no FILE type)
- Files attach to items, not navigable as separate items
- Items can have child items AND attached files
- Flexible hierarchy (TV shows, collections, custom organization)

## Data Model

### Item (modified)

Remove `type` field. Items are always containers.

```prisma
model Item {
  id        String   @id @default(cuid())
  name      String
  order     Int      @default(0)
  depth     Int      @default(0)

  // Hierarchy
  parentId  String?
  parent    Item?    @relation("ItemChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children  Item[]   @relation("ItemChildren")

  // Ownership
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // SFTP connection (optional - for organization-only items)
  connectionId   String?
  connection     SftpConnection? @relation(fields: [connectionId], references: [id], onDelete: SetNull)
  sftpPath       String?    // Folder path on server

  // Attached files
  files     ItemFile[]

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
  @@index([userId])
  @@index([userId, parentId, order])
  @@index([connectionId, sftpPath])
}
```

### ItemFile (new)

```prisma
enum FileType {
  MEDIA
  ARTWORK
  SUBTITLE
}

model ItemFile {
  id        String   @id @default(cuid())

  // Belongs to item
  itemId    String
  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)

  // File info
  filename  String
  sftpPath  String   // Full path on server
  fileType  FileType
  mimeType  String?
  size      BigInt?
  sftpModifiedAt DateTime?

  // Playback (for MEDIA files)
  playbackPosition Float?    // Seconds
  playbackDuration Float?    // Seconds

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([itemId, sftpPath])
  @@index([itemId])
  @@index([fileType])
}
```

### SftpConnection (modified)

Add WebDAV endpoint for streaming. WebDAV credentials are separate from SFTP because:

- Different servers may have different auth requirements
- WebDAV often uses HTTP Basic Auth while SFTP uses SSH keys
- Allows flexibility (same server, different credentials; or different servers entirely)

```prisma
model SftpConnection {
  id                  String    @id @default(cuid())
  userId              String
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // SFTP connection (file operations)
  name                String
  host                String
  port                Int       @default(22)
  username            String
  authType            AuthType  @default(PASSWORD)
  encryptedCredential String
  basePath            String    @default("/")

  // WebDAV endpoint (streaming) - separate credentials
  webdavUrl               String?   // e.g., https://webdav.server.com/
  webdavUsername          String?   // Often same as SFTP, but can differ
  encryptedWebdavPassword String?   // Encrypted with same AES-256-GCM

  // Status
  isActive            Boolean   @default(true)
  lastConnectedAt     DateTime?
  lastSyncAt          DateTime?
  lastError           String?

  // Related items
  items               Item[]

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([userId, name])
  @@index([userId])
}
```

## File Type Detection

Auto-categorize by extension on sync:

| FileType | Extensions                                                                               |
| -------- | ---------------------------------------------------------------------------------------- |
| MEDIA    | `.mp4`, `.mkv`, `.avi`, `.m4v`, `.webm`, `.mov`, `.mp3`, `.m4a`, `.flac`, `.wav`, `.ogg` |
| ARTWORK  | `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`                                                 |
| SUBTITLE | `.srt`, `.vtt`, `.sub`, `.ass`                                                           |

## Sync Behavior

When syncing an SFTP connection:

1. **List folder tree** from SFTP server recursively

2. **For each folder** → Create/update Item
   - Store folder name and full `sftpPath`

3. **For each file** → Create/update ItemFile
   - Attach to parent folder's Item
   - Auto-detect `fileType` by extension
   - Store `filename`, `sftpPath`, `size`, `mimeType`

4. **Deleted folders** → Remove Item (cascades to ItemFiles)

5. **Deleted files** → Remove ItemFile

6. **Renamed folders** → Update Item name AND propagate path changes to all child ItemFiles
   - When folder `/movies/The Matrix` renamed to `/movies/Matrix (1999)`
   - Update all ItemFile.sftpPath values that start with old path
   - Use database transaction to ensure atomicity

### Example

SFTP structure:

```
/movies/
  The Matrix/
    matrix-2160p.mkv
    matrix-1080p.mkv
    poster.jpg
    english.srt
```

Results in:

```
Item: "movies" (sftpPath: /movies)
  Item: "The Matrix" (sftpPath: /movies/The Matrix)
    ItemFile: matrix-2160p.mkv (MEDIA)
    ItemFile: matrix-1080p.mkv (MEDIA)
    ItemFile: poster.jpg (ARTWORK)
    ItemFile: english.srt (SUBTITLE)
```

## Dual-Protocol Streaming

**Why two protocols:**

- **SFTP**: Reliable for file operations (list, create, rename, delete)
- **WebDAV**: HTTP-based, supports range requests for video seeking

**Proxy pattern:**

- Browser never sees credentials
- All authentication happens server-side

**Flow:**

```
Browser              Next.js API           WebDAV Server
   │                     │                      │
   ├─GET /api/stream/abc─▶│                      │
   │   Range: bytes=0-    │                      │
   │                     ├─GET /path/file.mp4───▶│
   │                     │  Authorization: Basic │
   │                     │  Range: bytes=0-      │
   │                     │◀─────206 Partial──────┤
   │◀────206 Partial─────┤                      │
```

**API route:**

```
GET /api/stream/[fileId]
GET /api/stream/[fileId]?range=bytes=1000-2000
```

**Security:**

- Verify user owns the ItemFile before streaming
- Sanitize `sftpPath` before constructing WebDAV URL (prevent path traversal)
- Validate path doesn't contain `..`, null bytes, or escape sequences
- Use `lib/sftp-utils.ts` sanitization functions

**Error handling:**

- 401: WebDAV auth failed → return 502 with "Streaming unavailable"
- 404: File not found on WebDAV → return 404, mark ItemFile for re-sync
- 5xx: WebDAV server error → return 502 with retry-after header
- Timeout: Stream taking too long → return 504

## Media Player

**Vidstack player:**

- Full-screen overlay with dark backdrop
- Close button + Escape key
- Subtitle track support (VTT, SRT)
- Range-based seeking

**Resume behavior:**

- Always auto-resume from saved `playbackPosition`
- Only reset to 0 when video actually ends (reaches 100%)
- No prompts

**Progress storage:**

- `playbackPosition`: current time in seconds
- `playbackDuration`: total length in seconds
- Updated on pause/close

## UI Changes

**Item browsing:**

- Tree view and grid view remain
- Items show artwork thumbnail (first ARTWORK file)
- Click item → opens detail view

**Item detail view:**

- Shows item name, artwork
- Lists attached media files (quality/size info)
- Click media file → streams in Vidstack player
- Subtitle selector when playing
- Download option for files

**Connection settings:**

- Add WebDAV URL field alongside SFTP settings

**Non-SFTP items:**

- Same UI, just no files section
- Pure organization containers

## Testing Strategy

### Unit Tests

- `lib/crypto.ts` - encryption/decryption (existing)
- `lib/sftp-utils.ts` - path sanitization, path traversal prevention
- `lib/file-type-utils.ts` - extension detection for all FileType categories
- `lib/webdav-utils.ts` - URL construction, path escaping
- Playback position edge cases (0%, 99.9%, 100%)

### Integration Tests

- ItemFile CRUD with real database
- Sync creates Items + attaches ItemFiles correctly
- Rename propagation updates all child ItemFile paths
- WebDAV proxy authentication flow
- Streaming endpoint authorization (user ownership check)

### E2E Tests

- Create connection (SFTP + WebDAV URLs + credentials)
- Sync folder structure, verify Items and ItemFiles created
- Browse items, see attached files with correct types
- Stream media file (verify playback starts, range requests work)
- Save and resume from position
- Artwork thumbnail display

### Docker Setup

```yaml
# e2e/docker-compose.yml additions
services:
  sftp:
    # existing atmoz/sftp container

  webdav:
    image: bytemark/webdav
    environment:
      AUTH_TYPE: Basic
      USERNAME: testuser
      PASSWORD: testpass
    volumes:
      - ./fixtures/media:/var/lib/dav/data
    ports:
      - "8080:80"
```

Test fixtures include sample media files:

- `test-video.mp4` (small, valid MP4 for streaming tests)
- `poster.jpg` (artwork detection)
- `subtitles.srt` (subtitle detection)

## Migration

**Database changes:**

1. Drop `ItemType` enum
2. Remove `type` field from Item
3. Delete all Items where `type = FILE`
4. Add `webdavUrl` to SftpConnection
5. Create `ItemFile` table with `FileType` enum

**User impact:**

- Existing folder structure preserved
- Files no longer appear as items
- Must re-sync connections to attach files
- Add WebDAV URL to existing connections

## Files to Modify

### Database

- `prisma/schema.prisma` - Add ItemFile, modify Item, modify SftpConnection

### Lib

- `lib/sftp-actions.ts` - Update sync to create ItemFiles, handle renames
- `lib/file-type-utils.ts` - New, extension detection
- `lib/webdav-utils.ts` - New, URL construction and path sanitization
- `lib/types.ts` - Update types

### API Routes

- `app/api/stream/[fileId]/route.ts` - New, WebDAV streaming proxy

### Components

- `components/sftp/connection-form.tsx` - Add WebDAV URL and credentials fields
- `components/items/item-detail.tsx` - New, show attached files
- `components/media/media-player.tsx` - New, Vidstack wrapper
- `components/media/media-overlay.tsx` - New, fullscreen player

### Pages

- `app/(dashboard)/dashboard/connections/[id]/page.tsx` - Update for new model

## Validation Notes

Design validated 2026-01-02. Issues addressed:

1. **WebDAV credentials** - Added separate `webdavUsername` and `encryptedWebdavPassword` fields to SftpConnection model. Credentials are independent from SFTP.

2. **Rename propagation** - Added step 6 to sync behavior: when folder renamed, update all child ItemFile.sftpPath values in a transaction.

3. **Path validation** - Added security section to streaming proxy: sanitize paths, prevent traversal attacks, use existing `lib/sftp-utils.ts` functions.

4. **Error handling** - Added error handling section with specific HTTP status codes for WebDAV failures.

5. **Testing expanded** - Added WebDAV Docker container config, sample fixtures, and additional test cases.

## Summary

| Aspect      | Decision                              |
| ----------- | ------------------------------------- |
| Items       | Always containers, no FILE type       |
| Files       | Attached via ItemFile model           |
| File types  | Auto-detect: MEDIA, ARTWORK, SUBTITLE |
| Sync        | Folders → Items, files → ItemFiles    |
| Streaming   | SFTP for ops, WebDAV for playback     |
| WebDAV auth | Separate credentials from SFTP        |
| Player      | Vidstack, fullscreen overlay          |
| Resume      | Auto-resume, reset only at 100%       |
| Progress    | Position/duration per ItemFile        |
