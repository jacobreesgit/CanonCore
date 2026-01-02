# Deployment 0.12.0 - SFTP Connections

**Date**: 2026-01-02

## Summary

This release adds bidirectional SFTP connection management, enabling users to connect to remote SFTP servers, sync files, upload content, and download items directly from the web interface.

## Features

### SFTP Connection Management

- **Connection CRUD**: Create, read, update, and delete SFTP connections with encrypted credential storage
- **Connection testing**: Test button with latency display to verify server connectivity
- **Password and SSH key auth**: Support for both authentication methods
- **Encrypted credentials**: AES-256-GCM encryption for stored passwords and private keys

### File Synchronization

- **Bidirectional sync**: Sync files between SFTP server and web interface
- **Sync status badges**: Visual indicators showing SYNCED, PENDING_UPLOAD, PENDING_DOWNLOAD, CONFLICT, or ERROR states
- **Nested structure sync**: Full support for recursive folder synchronization

### File Operations

- **Remote folder creation**: Create folders directly on SFTP server from web UI
- **File uploads**: Upload files to SFTP server via file dialog
- **File downloads**: Download files from SFTP server with progress indication
- **Rename and delete**: Modify items in web UI with changes reflected on server

### UI Components

- **Connections list page**: Dashboard for managing all SFTP connections (`/dashboard/connections`)
- **Connection form**: Create/edit form with validation (`/dashboard/connections/new`, `/dashboard/connections/[id]/edit`)
- **Connection detail page**: Browse synced files within a connection (`/dashboard/connections/[id]`)
- **SFTP item navigation**: Drill-down into SFTP folders with breadcrumb navigation

## Technical Implementation

### Database

- New `SftpConnection` model with encrypted credential storage
- Extended `Item` model with SFTP fields: `type`, `sftpPath`, `mimeType`, `size`, `syncStatus`, `lastSyncedAt`, `sftpModifiedAt`, `connectionId`
- New enums: `ItemType` (FOLDER, FILE), `SyncStatus`, `AuthType` (PASSWORD, PRIVATE_KEY)
- Indexes on `connectionId/sftpPath` and `syncStatus` for query performance

### Server Actions

- `lib/sftp-actions.ts`: Connection CRUD, sync operations, file operations
- `lib/sftp-client.ts`: SFTP client wrapper with connection pooling
- `lib/sftp-utils.ts`: Path sanitization to prevent directory traversal attacks
- `lib/crypto.ts`: AES-256-GCM encryption/decryption for credentials

### API Routes

- `app/api/sftp/download/[itemId]/route.ts`: Stream file downloads from SFTP server

### Components

- `components/sftp/connection-card.tsx`: Connection card with test/edit/delete actions
- `components/sftp/connection-form.tsx`: Form with password/SSH key toggle
- `components/sftp/connection-test-button.tsx`: Test connectivity with latency display
- `components/sftp/download-button.tsx`: File download with progress animation
- `components/sftp/file-upload-dialog.tsx`: Upload files to SFTP server
- `components/sftp/sync-button.tsx`: Trigger full sync with progress states
- `components/sftp/sync-status-badge.tsx`: Visual sync status indicator

### Navigation

- Added "Connections" link under Settings in sidebar
- Context-aware breadcrumbs for SFTP folder navigation

## Testing

### Unit Tests

- `tests/unit/lib/crypto.test.ts`: Encryption/decryption tests
- `tests/unit/lib/sftp-actions.test.ts`: SFTP action tests with mocked clients
- `tests/unit/lib/sftp-utils.test.ts`: Path sanitization and validation tests
- `tests/unit/e2e/sftp-fixture.test.ts`: SFTP fixture unit tests

### Integration Tests

- `tests/integration/sftp/sftp-connection.test.ts`: Real database CRUD operations with encrypted credentials

### E2E Tests

- `e2e/journeys/connections/connections-crud.spec.ts`: Connection management flows
- `e2e/journeys/sftp/sftp-sync.spec.ts`: Sync operations with Docker SFTP containers
- `e2e/journeys/sftp/sftp-server-to-web.spec.ts`: Server-to-web sync verification
- `e2e/journeys/sftp/sftp-web-to-server.spec.ts`: Web-to-server operations
- `e2e/docker-compose.yml`: Parallel SFTP container configuration (up to 8 workers)
- `e2e/journeys/global.setup.ts`: Docker startup and container health checks
- `e2e/journeys/global.teardown.ts`: Container cleanup

## Environment Variables

New required variable:

- `ENCRYPTION_KEY`: Base64-encoded 32-byte key for AES-256-GCM credential encryption (generate with: `openssl rand -base64 32`)

## Dependencies

New production dependency:

- `ssh2-sftp-client@^12.0.1`: SFTP client for Node.js

New dev dependency:

- `@types/ssh2-sftp-client@^9.0.6`: TypeScript types for SFTP client

## Files Changed

- 57 files added/modified
- New components: 8 SFTP-related components
- New pages: 5 connection management pages
- New tests: 6 test files (unit, integration, E2E)
- Database migration: 1 new migration for SFTP schema
