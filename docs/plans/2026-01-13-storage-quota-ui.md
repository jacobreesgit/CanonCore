# Storage Quota UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display Google Drive storage usage to users in the sidebar and Settings dialog, with warnings when storage is low.

**Architecture:** Leverage existing `quotaBytesUsed` and `quotaBytesTotal` fields in `GoogleDriveConnection` model. Update quota during sync operations. Display progress bar and warning badges in UI components.

**Tech Stack:** React, Tailwind CSS, shadcn/ui Progress component, Prisma

---

## Prerequisites

- Google Drive connection already established (P1 complete)
- `quotaBytesUsed` and `quotaBytesTotal` fields exist in schema (already present)

## Task 1: Update Quota During Sync

**Files:**

- Modify: `lib/google-drive-sync.ts:syncFromGoogleDrive()`
- Test: `tests/unit/lib/google-drive-sync.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/google-drive-sync.test.ts`:

```typescript
describe("syncFromGoogleDrive - quota update", () => {
  it("should update quota bytes after successful sync", async () => {
    mockDrive.about = {
      get: vi.fn().mockResolvedValue({
        data: {
          storageQuota: {
            usage: "1073741824", // 1 GB
            limit: "16106127360", // 15 GB
          },
        },
      }),
    };

    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      rootFolderId: "root-123",
      encryptedRefreshToken: "encrypted_refresh",
      encryptedAccessToken: "encrypted_access",
      accessTokenExpiry: new Date(Date.now() + 3600000),
      quotaBytesUsed: null,
      quotaBytesTotal: null,
    } as any);

    mockDrive.files = {
      list: vi.fn().mockResolvedValue({ data: { files: [] } }),
      get: vi
        .fn()
        .mockResolvedValue({ data: { id: "root-123", trashed: false } }),
    };

    await syncFromGoogleDrive();

    expect(prisma.googleDriveConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quotaBytesUsed: BigInt("1073741824"),
          quotaBytesTotal: BigInt("16106127360"),
        }),
      })
    );
  });

  it("should handle missing quota gracefully", async () => {
    mockDrive.about = {
      get: vi.fn().mockResolvedValue({
        data: { storageQuota: {} },
      }),
    };

    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      rootFolderId: "root-123",
      encryptedRefreshToken: "encrypted_refresh",
      encryptedAccessToken: "encrypted_access",
      accessTokenExpiry: new Date(Date.now() + 3600000),
    } as any);

    mockDrive.files = {
      list: vi.fn().mockResolvedValue({ data: { files: [] } }),
      get: vi
        .fn()
        .mockResolvedValue({ data: { id: "root-123", trashed: false } }),
    };

    const result = await syncFromGoogleDrive();
    expect(result.success).toBe(true);
  });

  it("should continue sync if quota fetch fails", async () => {
    mockDrive.about = {
      get: vi.fn().mockRejectedValue(new Error("API error")),
    };

    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      rootFolderId: "root-123",
      encryptedRefreshToken: "encrypted_refresh",
      encryptedAccessToken: "encrypted_access",
      accessTokenExpiry: new Date(Date.now() + 3600000),
    } as any);

    mockDrive.files = {
      list: vi.fn().mockResolvedValue({ data: { files: [] } }),
      get: vi
        .fn()
        .mockResolvedValue({ data: { id: "root-123", trashed: false } }),
    };

    const result = await syncFromGoogleDrive();
    // Sync should still succeed even if quota fetch fails
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/google-drive-sync.test.ts -t "quota update"`
Expected: FAIL - quota not being updated

**Step 3: Write minimal implementation**

In `lib/google-drive-sync.ts`, modify the existing update at line ~179-187 to include quota fetch.

Replace the existing update block:

```typescript
// Update last sync time
await prisma.googleDriveConnection.update({
  where: { userId: session.user.id },
  data: {
    lastSyncAt: new Date(),
    lastError:
      ctx.errors.length > 0 ? `${ctx.errors.length} files failed` : null,
  },
});
```

With this combined quota + sync update:

```typescript
// Fetch quota and update connection in single DB call
let quotaData: { usage?: bigint; limit?: bigint } = {};
try {
  const aboutResponse = await withRateLimit(() =>
    drive.about.get({ fields: "storageQuota" })
  );
  const quota = aboutResponse.data.storageQuota;
  if (quota?.usage && quota?.limit) {
    quotaData = {
      usage: BigInt(quota.usage),
      limit: BigInt(quota.limit),
    };
  }
} catch (error) {
  // Quota fetch failure is non-fatal - log and continue
  logger.warn({ err: error }, "[GoogleDrive] Failed to fetch quota");
}

// Update last sync time and quota in single operation
await prisma.googleDriveConnection.update({
  where: { userId: session.user.id },
  data: {
    lastSyncAt: new Date(),
    lastError:
      ctx.errors.length > 0 ? `${ctx.errors.length} files failed` : null,
    ...(quotaData.usage && { quotaBytesUsed: quotaData.usage }),
    ...(quotaData.limit && { quotaBytesTotal: quotaData.limit }),
  },
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/google-drive-sync.test.ts -t "quota update"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/google-drive-sync.ts tests/unit/lib/google-drive-sync.test.ts
git commit -m "$(cat <<'EOF'
feat(google-drive): update storage quota during sync

Fetch and store user's Drive storage quota after each successful sync.
Quota is displayed in UI to warn users before they run out of space.
Combined with existing sync update for single DB call efficiency.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create Storage Bar Component

**Files:**

- Create: `components/google-drive/storage-bar.tsx`
- Test: `tests/unit/components/google-drive/storage-bar.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/google-drive/storage-bar.test.tsx`:

```typescript
/**
 * Unit tests for StorageBar component.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StorageBar } from "@/components/google-drive/storage-bar";

describe("StorageBar", () => {
  it("renders storage usage text", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("1073741824")} // 1 GB
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    expect(screen.getByText(/1\.0 GB/)).toBeInTheDocument();
    expect(screen.getByText(/15\.0 GB/)).toBeInTheDocument();
  });

  it("renders progress bar with correct percentage", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("8053063680")} // 7.5 GB
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50");
  });

  it("has accessible aria-label", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("8053063680")} // 7.5 GB (50%)
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Storage")
    );
  });

  it("shows warning when usage > 80%", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("13684808550")} // 12.75 GB (85%)
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    expect(screen.getByText(/Storage almost full/i)).toBeInTheDocument();
  });

  it("shows critical warning when usage > 95%", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("15300820992")} // 14.25 GB (95%)
        bytesTotal={BigInt("16106127360")} // 15 GB
      />
    );

    expect(screen.getByText(/Storage critical/i)).toBeInTheDocument();
  });

  it("renders compact variant without text", () => {
    render(
      <StorageBar
        bytesUsed={BigInt("1073741824")}
        bytesTotal={BigInt("16106127360")}
        variant="compact"
      />
    );

    expect(screen.queryByText(/GB/)).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders null when bytesTotal is null", () => {
    const { container } = render(
      <StorageBar bytesUsed={null} bytesTotal={null} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders null when bytesTotal is zero", () => {
    const { container } = render(
      <StorageBar bytesUsed={BigInt(0)} bytesTotal={BigInt(0)} />
    );

    expect(container.firstChild).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/google-drive/storage-bar.test.tsx`
Expected: FAIL - component doesn't exist

**Step 3: Write minimal implementation**

Create `components/google-drive/storage-bar.tsx`:

```typescript
/**
 * Storage usage bar component for Google Drive quota display.
 * Shows usage percentage with warning states for low storage.
 */

"use client";

import { Progress } from "@/components/ui/progress";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StorageBarProps {
  /** Bytes currently used */
  bytesUsed: bigint | null;
  /** Total bytes available */
  bytesTotal: bigint | null;
  /** Display variant */
  variant?: "default" | "compact";
  /** Additional class names */
  className?: string;
}

/**
 * Formats bytes to human-readable string (e.g., "14.2 GB").
 */
function formatBytes(bytes: bigint): string {
  const gb = Number(bytes) / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = Number(bytes) / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(0)} MB`;
  }
  const kb = Number(bytes) / 1024;
  return `${kb.toFixed(0)} KB`;
}

/**
 * Storage bar with usage percentage and warning states.
 *
 * @param bytesUsed - Current storage usage
 * @param bytesTotal - Total storage quota
 * @param variant - "default" shows text, "compact" shows only bar
 * @param className - Additional styling
 */
export function StorageBar({
  bytesUsed,
  bytesTotal,
  variant = "default",
  className,
}: StorageBarProps) {
  // Don't render if no quota data
  if (bytesUsed === null || bytesTotal === null || bytesTotal === BigInt(0)) {
    return null;
  }

  const percentage = Math.round(
    (Number(bytesUsed) / Number(bytesTotal)) * 100
  );
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  const ariaLabel = `Storage usage: ${percentage}% full`;

  if (variant === "compact") {
    return (
      <Progress
        value={percentage}
        className={cn(
          "h-1.5",
          isCritical && "[&>div]:bg-destructive",
          isWarning && !isCritical && "[&>div]:bg-yellow-500",
          className
        )}
        aria-label={ariaLabel}
        aria-valuenow={percentage}
      />
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Progress
        value={percentage}
        className={cn(
          "h-2",
          isCritical && "[&>div]:bg-destructive",
          isWarning && !isCritical && "[&>div]:bg-yellow-500"
        )}
        aria-label={ariaLabel}
        aria-valuenow={percentage}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {formatBytes(bytesUsed)} / {formatBytes(bytesTotal)}
        </span>
        {isCritical && (
          <span className="text-destructive flex items-center gap-1">
            <AlertTriangle className="size-3" />
            Storage critical
          </span>
        )}
        {isWarning && !isCritical && (
          <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
            <AlertTriangle className="size-3" />
            Storage almost full
          </span>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/google-drive/storage-bar.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/google-drive/storage-bar.tsx tests/unit/components/google-drive/storage-bar.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add StorageBar component for Drive quota display

Shows storage usage with progress bar and warning states:
- Yellow warning at 80% usage
- Red critical warning at 95% usage
- Compact variant for sidebar display
- Accessible aria-label for screen readers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Storage Bar to Settings Dialog

**Files:**

- Modify: `components/google-drive/settings-section.tsx`
- Modify: `tests/unit/components/google-drive/settings-section.test.tsx` (existing file)

**Step 1: Write the failing test**

Add to existing `tests/unit/components/google-drive/settings-section.test.tsx`:

```typescript
describe("Storage Quota Display", () => {
  const mockConnectionWithQuota = {
    email: "test@gmail.com",
    rootFolderId: "folder-abc123",
    isActive: true,
    needsReauth: false,
    lastSyncAt: new Date("2026-01-10T12:00:00Z"),
    lastError: null,
    quotaBytesUsed: BigInt("8053063680"), // 7.5 GB
    quotaBytesTotal: BigInt("16106127360"), // 15 GB
  };

  it("displays storage bar when quota data exists", () => {
    render(
      <GoogleDriveSettingsSection
        connection={mockConnectionWithQuota}
        onConnectionChange={vi.fn()}
      />
    );

    expect(screen.getByText(/7\.5 GB/)).toBeInTheDocument();
    expect(screen.getByText(/15\.0 GB/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("does not show storage bar when quota is null", () => {
    render(
      <GoogleDriveSettingsSection
        connection={{
          ...mockConnectionWithQuota,
          quotaBytesUsed: null,
          quotaBytesTotal: null,
        }}
        onConnectionChange={vi.fn()}
      />
    );

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows Manage Storage link when quota exists", () => {
    render(
      <GoogleDriveSettingsSection
        connection={mockConnectionWithQuota}
        onConnectionChange={vi.fn()}
      />
    );

    const link = screen.getByRole("link", { name: /manage storage/i });
    expect(link).toHaveAttribute("href", "https://one.google.com/storage");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not show Manage Storage link when quota is null", () => {
    render(
      <GoogleDriveSettingsSection
        connection={{
          ...mockConnectionWithQuota,
          quotaBytesUsed: null,
          quotaBytesTotal: null,
        }}
        onConnectionChange={vi.fn()}
      />
    );

    expect(
      screen.queryByRole("link", { name: /manage storage/i })
    ).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/components/google-drive/settings-section.test.tsx -t "Storage Quota"`
Expected: FAIL - StorageBar not rendered

**Step 3: Write minimal implementation**

Update `components/google-drive/settings-section.tsx`:

1. Add import at top:

```typescript
import { StorageBar } from "@/components/google-drive/storage-bar";
```

2. Add storage section inside the connection card, after the info section:

```typescript
{/* Storage section - only show if quota data exists */}
{connection.quotaBytesUsed !== null && connection.quotaBytesTotal !== null && (
  <div className="space-y-2 border-t p-3">
    <Label className="text-xs text-muted-foreground">Storage</Label>
    <StorageBar
      bytesUsed={connection.quotaBytesUsed}
      bytesTotal={connection.quotaBytesTotal}
    />
    <a
      href="https://one.google.com/storage"
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
    >
      Manage Storage
      <ExternalLink className="size-3" />
    </a>
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/components/google-drive/settings-section.test.tsx -t "Storage Quota"`
Expected: PASS

**Step 5: Commit**

```bash
git add components/google-drive/settings-section.tsx tests/unit/components/google-drive/settings-section.test.tsx
git commit -m "$(cat <<'EOF'
feat(settings): display Drive storage quota in settings dialog

Shows storage usage bar with "Manage Storage" link to Google One.
Only displays when quota data is available from sync.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update GoogleDriveConnection Type

**Files:**

- Modify: `lib/types.ts`

**Step 1: Verify current type**

The current `GoogleDriveConnection` type in `lib/types.ts` (lines 203-210) is:

```typescript
export interface GoogleDriveConnection {
  email: string;
  rootFolderId: string | null;
  isActive: boolean;
  needsReauth: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
}
```

**Step 2: Add quota fields only**

Update to add quota fields while preserving all existing fields:

```typescript
export interface GoogleDriveConnection {
  email: string;
  rootFolderId: string | null;
  isActive: boolean;
  needsReauth: boolean;
  lastSyncAt: Date | null;
  lastError: string | null;
  quotaBytesUsed: bigint | null;
  quotaBytesTotal: bigint | null;
}
```

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "$(cat <<'EOF'
chore(types): add quota fields to GoogleDriveConnection type

Add quotaBytesUsed and quotaBytesTotal fields for storage display.
Preserves all existing fields for backward compatibility.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: E2E Test for Storage Display

**Files:**

- Modify: `e2e/journeys/google-drive/drive-connection.spec.ts`

**Step 1: Add E2E test**

Add to `e2e/journeys/google-drive/drive-connection.spec.ts`:

```typescript
test("displays storage quota in settings when connected", async ({
  page,
  setupDriveConnection,
  testUser,
}) => {
  await setupDriveConnection(testUser.id);
  await page.goto("/my-items");

  // Open settings dialog
  await page.getByRole("button", { name: /settings/i }).click();

  // Trigger sync to fetch quota
  await page.getByRole("button", { name: /sync/i }).click();

  // Wait for sync to complete via toast notification
  await expect(
    page.getByText(/sync complete|synced/i)
  ).toBeVisible({ timeout: 15000 });

  // Re-open settings to see updated quota
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /settings/i }).click();

  // Verify storage bar is visible
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByText(/GB/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /manage storage/i })
  ).toBeVisible();

  // Verify link points to Google One storage
  const manageLink = page.getByRole("link", { name: /manage storage/i });
  await expect(manageLink).toHaveAttribute(
    "href",
    "https://one.google.com/storage"
  );
});

test("shows warning when storage is almost full", async ({
  page,
  setupDriveConnection,
  testUser,
}) => {
  // This test requires a Drive account with >80% storage used
  // Skip if test account doesn't have high usage
  test.skip(
    process.env.E2E_DRIVE_HIGH_USAGE !== "true",
    "Requires Drive account with >80% storage usage"
  );

  await setupDriveConnection(testUser.id);
  await page.goto("/my-items");

  await page.getByRole("button", { name: /settings/i }).click();
  await page.getByRole("button", { name: /sync/i }).click();
  await expect(page.getByText(/sync complete|synced/i)).toBeVisible({
    timeout: 15000,
  });

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /settings/i }).click();

  // Verify warning is displayed
  await expect(
    page.getByText(/storage almost full|storage critical/i)
  ).toBeVisible();
});
```

**Step 2: Run E2E test**

Run: `pnpm test:e2e e2e/journeys/google-drive/drive-connection.spec.ts -g "storage quota"`
Expected: PASS

**Step 3: Commit**

```bash
git add e2e/journeys/google-drive/drive-connection.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): verify storage quota display in settings

Tests storage bar visibility, Manage Storage link, and warning states.
Uses proper sync completion assertions instead of hardcoded timeouts.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Testing Summary

### New Tests

| Type | File                                                             | Tests                              |
| ---- | ---------------------------------------------------------------- | ---------------------------------- |
| Unit | `tests/unit/lib/google-drive-sync.test.ts`                       | Quota update during sync (3 tests) |
| Unit | `tests/unit/components/google-drive/storage-bar.test.tsx`        | StorageBar component (8 tests)     |
| Unit | `tests/unit/components/google-drive/settings-section.test.tsx`   | Settings storage display (4 tests) |
| E2E  | `e2e/journeys/google-drive/drive-connection.spec.ts`             | Storage quota in settings (2 tests)|

### Existing Tests - No Changes Needed

The existing Google Drive tests don't need modification as they test sync functionality, not quota display.

---

## Final Checklist

- [ ] Quota fetched and stored during sync (single DB call)
- [ ] StorageBar component with warning states and accessibility
- [ ] Storage displayed in Settings dialog
- [ ] "Manage Storage" link to Google One
- [ ] Unit tests for all new code
- [ ] E2E test for storage display with proper assertions
- [ ] Type definitions updated (quota fields only)
