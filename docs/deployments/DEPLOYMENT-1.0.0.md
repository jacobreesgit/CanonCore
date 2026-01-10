# Deployment 1.0.0 - Google Drive Integration

**Date**: 2026-01-10
**Branch**: feature/google-drive-integration

## Summary

This major release replaces SFTP with Google Drive as the primary cloud storage backend. Users can now connect their Google Drive account via OAuth, sync folders bidirectionally, and upload files directly from the browser to Google Drive. This is a breaking change that requires database migration and Google OAuth configuration.

## Breaking Changes

| Change                   | Impact                                                       |
| ------------------------ | ------------------------------------------------------------ |
| SFTP removed             | All SFTP connections, components, and APIs deleted           |
| Connections page removed | No `/my-items/connections` route - Drive managed in Settings |
| Database seeding removed | `prisma/seed.ts` and related files deleted                   |
| Schema migration         | New GoogleDriveConnection model, SFTP fields removed         |

### Migration Path

Existing SFTP connections are not migrated. Users must:

1. Connect Google Drive via Settings dialog
2. Re-sync their content from Google Drive

## New Features

### Google Drive OAuth Integration

Secure OAuth 2.0 flow with full `drive` scope for bidirectional sync:

| Feature           | Implementation                                   |
| ----------------- | ------------------------------------------------ |
| CSRF protection   | HMAC-SHA256 signed state with 10-minute expiry   |
| Token encryption  | AES-256-GCM encrypted access and refresh tokens  |
| Auto-refresh      | Transparent token refresh before expiry          |
| Single connection | One Drive account per user (upsert on reconnect) |

### Browser-to-Drive Uploads

Direct uploads from browser to Google Drive with progress tracking:

| Feature           | Implementation                             |
| ----------------- | ------------------------------------------ |
| Resumable uploads | Google's resumable upload protocol         |
| Progress tracking | XMLHttpRequest with upload progress events |
| Batch uploads     | Concurrent upload manager (3 parallel)     |
| File type picker  | Media, artwork, or subtitle file filters   |

### Sync Status Indicators

Visual feedback throughout the UI:

| Indicator        | Meaning                             |
| ---------------- | ----------------------------------- |
| No badge         | Synced with Google Drive (clean UI) |
| Animated spinner | Sync in progress                    |
| Small dot        | Pending sync                        |
| Warning triangle | Sync error (hover for details)      |

### Media Player Improvements

| Change          | Description                                       |
| --------------- | ------------------------------------------------- |
| All media types | Unified player for video, audio, and images       |
| Range requests  | HTTP Range header support for video seeking       |
| MIME inference  | Fallback to filename extension for type detection |

### Settings Dialog Redesign

Renamed from "Profile Settings" to "Settings" with new Google Drive section:

- Connection status with email display
- Connect/Disconnect/Reconnect actions
- Last sync timestamp
- Error state handling with reconnect prompt

## Removed

| Component                                    | Replacement                   |
| -------------------------------------------- | ----------------------------- |
| SFTP client (`lib/sftp-client.ts`)           | Google Drive client           |
| SFTP actions (`lib/sftp-actions.ts`)         | Google Drive actions          |
| WebDAV utils (`lib/webdav-utils.ts`)         | Direct Drive streaming        |
| Connection pages (`/my-items/connections/*`) | Settings dialog               |
| Connection filter                            | Items show sync status inline |
| Docker SFTP containers                       | Not needed for Drive          |
| Database seeding                             | Manual testing via UI         |

## Files Changed

### Added (31 files)

```
# Google Drive Core
lib/google-drive-client.ts        # OAuth, Drive API wrapper, rate limiting
lib/google-drive-actions.ts       # Server actions for sync operations
lib/upload-utils.ts               # Browser upload utilities

# API Routes
app/api/auth/callback/google-drive/route.ts  # OAuth callback

# UI Components
components/google-drive/settings-section.tsx  # Drive settings UI
components/google-drive/oauth-toast.tsx       # OAuth result notifications
components/items/sync-badge.tsx               # Sync status indicators
components/items/file-type-combobox.tsx       # Upload file type picker

# E2E Tests
e2e/journeys/google-drive/drive-connection.spec.ts
e2e/journeys/google-drive/drive-sync.spec.ts
e2e/journeys/google-drive/drive-cloud-to-web.spec.ts
e2e/journeys/google-drive/drive-web-to-cloud.spec.ts
e2e/journeys/google-drive/drive-media.spec.ts

# Unit Tests
tests/unit/lib/google-drive-client.test.ts
tests/unit/lib/google-drive-actions.test.ts

# Database
prisma/migrations/20260108000000_add_google_drive_connection/
prisma/migrations/20260109133600_remove_sftp_completely/
```

### Deleted (30 files)

```
# SFTP (all removed)
lib/sftp-client.ts, lib/sftp-actions.ts, lib/sftp-utils.ts, lib/webdav-utils.ts
components/sftp/* (7 files)
app/api/sftp/download/file/[fileId]/route.ts

# Connection Pages
app/(my-items)/my-items/connections/* (3 pages)

# Seeding
prisma/seed.ts, prisma/seed-data.ts, prisma/seed-utils.ts, prisma/clear-seed.ts

# E2E (SFTP-specific)
e2e/docker-compose.yml
e2e/journeys/sftp/* (3 files)
e2e/journeys/connections/connections-crud.spec.ts
```

### Modified (significant)

```
# Schema
prisma/schema.prisma              # GoogleDriveConnection model, sync fields

# Core Components
components/items/items-view.tsx           # Sync badge integration
components/items/item-settings-dialog.tsx # Upload functionality
components/media/media-player.tsx         # All media types support
components/profile/settings-dialog.tsx    # Drive settings section

# API Routes
app/api/stream/[fileId]/route.ts   # Google Drive streaming
app/api/artwork/[fileId]/route.ts  # Google Drive artwork
```

## Test Results

| Suite      | Result                            |
| ---------- | --------------------------------- |
| Unit tests | 464 passed                        |
| E2E tests  | All Google Drive journeys passing |

### New Test Coverage

| Test File                    | Tests | Coverage                      |
| ---------------------------- | ----- | ----------------------------- |
| google-drive-client.test.ts  | 15    | OAuth, rate limiting, retries |
| google-drive-actions.test.ts | 35+   | Auth checks, sync operations  |
| drive-connection.spec.ts     | 5     | OAuth connect/disconnect E2E  |
| drive-sync.spec.ts           | 3     | Auto-sync behavior E2E        |

## Deployment Steps

### Prerequisites

1. Create Google Cloud project with OAuth consent screen
2. Enable Google Drive API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `{APP_URL}/api/auth/callback/google-drive`

### Environment Variables

Add to Vercel/production environment:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

Existing `ENCRYPTION_KEY` is used for token encryption.

### Deployment

1. Pull latest from feature branch
2. Run `pnpm install` (adds `googleapis`, `bottleneck`)
3. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```
4. Run `pnpm run check` to verify build
5. Deploy to Vercel
6. Verify OAuth redirect URI matches production URL

### Post-Deployment

- Existing users will see "Connect Google Drive" in Settings
- No data migration needed (SFTP data was test-only)

## Architecture Notes

### OAuth Security

```typescript
// CSRF state generation with HMAC signature
const state = generateOAuthState(userId);
// Format: base64(JSON({userId, timestamp, nonce})).signature

// Verification with timing-safe comparison
const verified = verifyOAuthState(state);
// Returns null if: invalid signature, expired (>10min), or tampered
```

### Token Management

```typescript
// Tokens encrypted at rest
encryptedRefreshToken: encryptCredential(refreshToken);

// Auto-refresh before expiry
if (connection.accessTokenExpiry < new Date(Date.now() + 5 * 60 * 1000)) {
  await refreshAccessToken(connection);
}
```

### Rate Limiting

```typescript
// Bottleneck: max 10 concurrent, 100ms between requests
const limiter = new Bottleneck({ maxConcurrent: 10, minTime: 100 });

// Exponential backoff with jitter for retries
const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
```

### Sync Flow

1. **Cloud-to-Web**: List Drive folder → Create/update Items → Attach files
2. **Web-to-Cloud**: Create Item → Create Drive folder → Upload files
3. **Per-file errors**: Individual failures don't abort entire sync
4. **Batched DB writes**: 50 files per transaction for performance

### File Streaming

```typescript
// Range request support for video seeking
if (range && fileSize > 0) {
  const { start, end } = parseRangeHeader(range, fileSize);
  // Returns 206 Partial Content with Content-Range header
}
```

## Version History

| Version | Date       | Summary                                      |
| ------- | ---------- | -------------------------------------------- |
| 1.0.0   | 2026-01-10 | Google Drive integration, SFTP removal       |
| 0.28.0  | 2026-01-07 | Loading spinner UX enhancement               |
| 0.27.0  | 2026-01-06 | Item descriptions and primary file selection |
