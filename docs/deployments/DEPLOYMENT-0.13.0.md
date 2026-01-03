# Deployment 0.13.0 - Media Library

**Date**: 2026-01-03

## Summary

This release adds media library support with video playback, WebDAV streaming, and organized file management. Items can now contain multiple files (media, artwork, subtitles) with automatic categorization and playback progress tracking.

## Features

### ItemFile Model

- **Multi-file items**: Items can contain multiple files organized by type (MEDIA, ARTWORK, SUBTITLE)
- **File type detection**: Automatic categorization based on file extensions
- **Playback tracking**: Store and resume playback position for media files
- **MIME type mapping**: Proper content types for video, audio, image, and subtitle files

### Video Playback

- **Vidstack player**: Cinematic video player with default controls
- **Subtitle support**: Load SRT, VTT, SUB, ASS subtitle files
- **Progress tracking**: Auto-save playback position with throttled updates
- **Resume playback**: Automatically resume from last position

### Media Overlay

- **Full-screen overlay**: Immersive media viewing experience
- **Item detail view**: Browse files associated with an item
- **Tabbed interface**: Switch between media, artwork, and subtitles

### WebDAV Streaming

- **Separate WebDAV credentials**: Optional WebDAV endpoint for streaming
- **Direct streaming**: Stream media files without downloading first
- **URL construction**: Build streaming URLs from connection configuration

### File Organization

- **Supported media**: MP4, MKV, AVI, M4V, WebM, MOV, MP3, M4A, FLAC, WAV, OGG
- **Artwork types**: JPG, JPEG, PNG, WebP, GIF
- **Subtitle formats**: SRT, VTT, SUB, ASS

## Technical Implementation

### Database

- New `ItemFile` model linked to items
- `FileType` enum: MEDIA, ARTWORK, SUBTITLE
- Playback fields: `playbackPosition`, `playbackDuration`
- WebDAV fields on `SftpConnection`: `webdavUrl`, `webdavUsername`, `encryptedWebdavPassword`
- Removed `ItemType` enum and `type` field from Item model
- Indexes on `itemId` and `fileType` for query performance

### Server Actions

- `lib/item-file-actions.ts`: Playback position updates, file queries
- `lib/file-type-utils.ts`: Extension-based file categorization
- `lib/webdav-utils.ts`: WebDAV URL construction and path encoding

### API Routes

- `app/api/sftp/download/file/[fileId]/route.ts`: Download individual files by ID
- `app/api/stream/[fileId]/route.ts`: Stream media via WebDAV

### Components

- `components/media/media-player.tsx`: Vidstack video player wrapper
- `components/media/media-overlay.tsx`: Full-screen media viewer
- `components/items/item-detail.tsx`: Item detail with files display
- `components/ui/tabs.tsx`: New shadcn/ui tabs component

### Removed Components

- `components/sftp/download-button.tsx`: Replaced by file-based downloads
- `components/sftp/file-upload-dialog.tsx`: Moved to connection-level operations
- `components/sftp/sync-status-badge.tsx`: Consolidated sync indicators
- `components/ui/progress.tsx`: Unused progress component

## Testing

### Unit Tests

- `tests/unit/lib/file-type-utils.test.ts`: File categorization tests
- `tests/unit/lib/item-file-actions.test.ts`: Playback action tests
- `tests/unit/lib/webdav-utils.test.ts`: WebDAV URL construction tests

### Integration Tests

- `tests/integration/items/item-file.test.ts`: ItemFile CRUD with real database

### E2E Tests

- `e2e/journeys/media/media-playback.spec.ts`: Video playback flows
- `e2e/pages/media.page.ts`: Media page object model

## Dependencies

New production dependency:

- `@vidstack/react@^1.12.13`: Modern video player for React

New UI component:

- `@radix-ui/react-tabs@^1.1.13`: Tabs primitive for shadcn/ui

## Database Migrations

- `20260102234138_add_item_file`: Add ItemFile model
- `20260102234624_add_webdav_fields`: Add WebDAV columns to SftpConnection
- `20260102235136_remove_item_type`: Remove unused type field from Item

## Files Changed

- 47 files added/modified
- New components: 4 media-related components
- New lib utilities: 3 files (file-type-utils, item-file-actions, webdav-utils)
- New tests: 6 test files (unit, integration, E2E)
- Database migrations: 3 new migrations
