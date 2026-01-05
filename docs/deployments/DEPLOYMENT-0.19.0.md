# Deployment 0.19.0 - Quick Create and Artwork Thumbnails

**Date**: 2026-01-05
**Branch**: development

## Summary

This release adds a Quick Create button to the sidebar for fast folder creation, an SFTP artwork endpoint for displaying thumbnails, and refreshed auth pages with video backgrounds. The seed system gains CLI arguments for selective seeding and SFTP upload support.

## Changes

### Quick Create Folder Dialog

New modal dialog replaces the inline input for creating folders:

- **Sidebar Quick Create button** - Creates folders at dashboard root from anywhere
- **Context menu integration** - Right-click "Add Subfolder" uses same dialog
- **Description field** - Optional 200-character description on creation
- **Keyboard support** - Enter to submit, auto-focus on open

Components:

- `components/items/add-folder-dialog.tsx` - Reusable dialog component
- `contexts/add-folder-context.tsx` - Global state for sidebar button
- `components/dashboard-providers.tsx` - Client-side provider wrapper

### SFTP Artwork Endpoint

New `/api/artwork/[fileId]` endpoint downloads artwork files via SFTP for thumbnail display:

- **Authentication** - Requires valid session
- **Authorization** - Verifies file ownership
- **Security** - Path traversal prevention, 10MB size limit
- **Caching** - 1-hour cache headers for performance
- **Error handling** - Specific HTTP codes (401, 403, 404, 413, 502, 504)

### Auth Pages Redesign

All auth pages now feature:

- Video background on desktop (right 40% of screen)
- Centered logo with app branding
- Cleaner form layout
- New assets: `logo.png`, `head.png`, `auth-bg.mp4`

### Sidebar Simplification

- Removed `nav-secondary.tsx` - Connections and Help links moved to footer
- Removed `add-item-button.tsx` - Replaced by Add Folder dialog
- Cleaner `app-sidebar.tsx` with context-aware navigation

### Seed System Enhancements

CLI arguments for selective seeding:

| Flag              | Description                 |
| ----------------- | --------------------------- |
| `--movies`        | Seed movies category only   |
| `--tv`            | Seed TV shows category only |
| `--music`         | Seed music category only    |
| `--filter=<text>` | Filter items by name        |
| `--no-upload`     | Skip SFTP file uploads      |
| `--upload-only`   | Only upload files, skip DB  |
| `--help`          | Show all options            |

New files:

- `prisma/seed-data.ts` - Declarative seed data definitions
- `prisma/seed-utils.ts` - File discovery and path mapping

SFTP upload support:

- Uploads files from `seed-media/` directory to SFTP server
- Skips existing files to avoid re-uploading
- Progress logging every 5 seconds during large uploads

## Files Changed

```
# New files
app/api/artwork/[fileId]/route.ts        # SFTP artwork download
components/items/add-folder-dialog.tsx   # Folder creation dialog
components/dashboard-providers.tsx       # Client-side providers
contexts/add-folder-context.tsx          # Quick Create context
prisma/seed-data.ts                      # Seed data definitions
prisma/seed-utils.ts                     # Seed utilities
public/logo.png                          # App logo
public/head.png                          # App head image
public/auth-bg.mp4                       # Auth video background

# Deleted files
components/items/add-item-button.tsx     # Replaced by dialog
components/nav-secondary.tsx             # Consolidated into sidebar

# Modified files
app/(auth)/*.tsx                         # Auth page redesign
app/(dashboard)/layout.tsx               # Add DashboardProviders
components/app-sidebar.tsx               # Simplified navigation
components/items/items-view.tsx          # Use AddFolderDialog
components/site-header.tsx               # Minor updates
lib/sftp-client.ts                       # Add checkFileExists
lib/sftp-utils.ts                        # Add isValidPath
prisma/seed.ts                           # CLI args, SFTP uploads

# New tests
tests/unit/api/artwork-route.test.ts     # 12 tests
tests/unit/components/add-folder-dialog.test.tsx  # 16 tests
tests/unit/components/site-header.test.tsx        # 8 tests
tests/unit/lib/sftp-client.test.ts       # 4 tests
tests/unit/prisma/seed-upload.test.ts    # 8 tests
e2e/journeys/items/items-quick-create.spec.ts     # 5 tests
```

## Test Results

- **Unit tests**: 288 passed (+48)
- **Integration tests**: 53 passed
- **E2E tests**: All passing (+5)

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install`
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No new environment variables required.

## Usage

### Quick Create

Click the **Quick Create** button in the sidebar to create a folder at the dashboard root. For subfolders, right-click any folder and select **Add Subfolder**.

### Seed with SFTP uploads

To seed with media files uploaded to SFTP:

1. Create `seed-media/` directory in project root
2. Organize files: `seed-media/Movies/...`, `seed-media/TV Shows/...`
3. Set SFTP environment variables:
   ```
   SFTP_SEED_HOST=your-sftp-server
   SFTP_SEED_USERNAME=user
   SFTP_SEED_PASSWORD=password
   ```
4. Run `pnpm run db:seed`

Files upload to `/seed-media/` on the SFTP server.
