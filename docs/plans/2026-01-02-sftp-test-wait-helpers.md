# SFTP Test Wait Helpers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create reliable SFTP test wait helpers that poll the server for confirmation before asserting UI state.

**Architecture:** Add wait helper functions to `sftp.fixture.ts` that poll the SFTP server until a condition is met or timeout occurs. Tests will use these helpers instead of arbitrary `waitForTimeout` calls. The pattern is: perform action → wait for SFTP server confirmation → assert state.

**Tech Stack:** Playwright, ssh2-sftp-client, TypeScript

---

## Problem Analysis

Current tests are flaky because they:

1. Use arbitrary `page.waitForTimeout()` calls with hardcoded delays
2. Check SFTP state immediately after UI action completes
3. Don't wait for SFTP server to confirm the operation completed

**Solution Pattern:**

- **Web→SFTP tests**: UI action → `waitForSftpPath()` → assert SFTP state
- **SFTP→Web tests**: SFTP action → UI sync → `waitForSftpSync()` (button shows "Synced") → assert UI state

---

### Task 1: Add SFTP Wait Helper Functions

**Files:**

- Modify: `e2e/fixtures/sftp.fixture.ts`
- Test: `tests/unit/e2e/sftp-fixture.test.ts` (new)

**Step 1: Write unit tests for wait helpers**

Create `tests/unit/e2e/sftp-fixture.test.ts`:

```typescript
/**
 * Unit tests for SFTP fixture wait helpers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ssh2-sftp-client
vi.mock("ssh2-sftp-client", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("SFTP Wait Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("waitForSftpPathExists", () => {
    it("resolves immediately when path exists", async () => {
      // Test implementation after helper is created
    });

    it("polls until path exists", async () => {
      // Test implementation after helper is created
    });

    it("throws after timeout if path never exists", async () => {
      // Test implementation after helper is created
    });
  });

  describe("waitForSftpPathDeleted", () => {
    it("resolves immediately when path does not exist", async () => {
      // Test implementation after helper is created
    });

    it("polls until path is deleted", async () => {
      // Test implementation after helper is created
    });

    it("throws after timeout if path still exists", async () => {
      // Test implementation after helper is created
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit -- tests/unit/e2e/sftp-fixture.test.ts`
Expected: Tests should be skipped or fail (no implementation yet)

**Step 3: Add wait helper functions to sftp.fixture.ts**

Add to `e2e/fixtures/sftp.fixture.ts`:

```typescript
/** Default options for wait helpers. */
interface WaitOptions {
  /** Maximum time to wait in milliseconds. */
  timeoutMs?: number;
  /** Interval between polls in milliseconds. */
  intervalMs?: number;
}

const DEFAULT_WAIT_OPTIONS: Required<WaitOptions> = {
  timeoutMs: 30000,
  intervalMs: 500,
};

/**
 * Waits for a path to exist on the SFTP server.
 * Polls the server until the path exists or timeout is reached.
 *
 * @param path - Path to check for existence
 * @param options - Wait configuration options
 * @throws Error if path does not exist after timeout
 *
 * @example
 * await waitForSftpPathExists(`${basePath}/new-folder`);
 */
export async function waitForSftpPathExists(
  path: string,
  options?: WaitOptions
): Promise<void> {
  const { timeoutMs, intervalMs } = { ...DEFAULT_WAIT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const exists = await verifySftpFileExists(path);
    if (exists) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`SFTP path "${path}" did not exist after ${timeoutMs}ms`);
}

/**
 * Waits for a path to be deleted from the SFTP server.
 * Polls the server until the path no longer exists or timeout is reached.
 *
 * @param path - Path to check for deletion
 * @param options - Wait configuration options
 * @throws Error if path still exists after timeout
 *
 * @example
 * await waitForSftpPathDeleted(`${basePath}/deleted-folder`);
 */
export async function waitForSftpPathDeleted(
  path: string,
  options?: WaitOptions
): Promise<void> {
  const { timeoutMs, intervalMs } = { ...DEFAULT_WAIT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const exists = await verifySftpFileExists(path);
    if (!exists) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`SFTP path "${path}" still exists after ${timeoutMs}ms`);
}

/**
 * Waits for a directory to contain a specific item.
 * Polls the server until the item appears in the directory listing.
 *
 * @param dirPath - Directory path to check
 * @param itemName - Name of item to find in directory
 * @param options - Wait configuration options
 * @throws Error if item not found after timeout
 *
 * @example
 * await waitForSftpDirContains(`${basePath}`, "new-file.txt");
 */
export async function waitForSftpDirContains(
  dirPath: string,
  itemName: string,
  options?: WaitOptions
): Promise<void> {
  const { timeoutMs, intervalMs } = { ...DEFAULT_WAIT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const items = await listSftpDir(dirPath);
    if (items.includes(itemName)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `SFTP directory "${dirPath}" did not contain "${itemName}" after ${timeoutMs}ms`
  );
}

/**
 * Waits for a directory to NOT contain a specific item.
 * Polls the server until the item is removed from the directory listing.
 *
 * @param dirPath - Directory path to check
 * @param itemName - Name of item that should not be in directory
 * @param options - Wait configuration options
 * @throws Error if item still found after timeout
 *
 * @example
 * await waitForSftpDirNotContains(`${basePath}`, "deleted-file.txt");
 */
export async function waitForSftpDirNotContains(
  dirPath: string,
  itemName: string,
  options?: WaitOptions
): Promise<void> {
  const { timeoutMs, intervalMs } = { ...DEFAULT_WAIT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const items = await listSftpDir(dirPath);
    if (!items.includes(itemName)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `SFTP directory "${dirPath}" still contains "${itemName}" after ${timeoutMs}ms`
  );
}
```

**Step 4: Run unit tests to verify helpers work**

Run: `pnpm run test:unit -- tests/unit/e2e/sftp-fixture.test.ts`
Expected: Tests pass

**Step 5: Commit**

```bash
git add e2e/fixtures/sftp.fixture.ts tests/unit/e2e/sftp-fixture.test.ts
git commit -m "feat(e2e): add SFTP wait helper functions for reliable polling"
```

---

### Task 2: Update Web→SFTP Tests to Use Wait Helpers

**Files:**

- Modify: `e2e/journeys/sftp/sftp-web-to-server.spec.ts`

**Step 1: Update imports**

Add to imports:

```typescript
import {
  sftpTestConfig,
  verifySftpFileExists,
  listSftpDir,
  cleanSftpTestDir,
  waitForSftpReady,
  waitForSftpPathExists,
  waitForSftpPathDeleted,
} from "../../fixtures/sftp.fixture";
```

**Step 2: Update "creates folder" test**

Replace the verification section:

```typescript
test("creates folder via web, exists on SFTP server", async ({
  page,
  connectionsPage,
}) => {
  // Navigate to connection
  const card = connectionsPage.getConnectionCard("Test SFTP Server");
  await card.click();
  await page.waitForLoadState("networkidle");

  // Create folder via UI
  await page.getByRole("button", { name: /add/i }).click();
  await page.getByPlaceholder(/folder name/i).fill("web-created-folder");
  await page.keyboard.press("Enter");

  // Wait for SFTP server to confirm folder exists
  await waitForSftpPathExists(`${sftpTestConfig.basePath}/web-created-folder`);

  // Verify folder appears in UI
  await expect(
    page.getByRole("listitem").filter({ hasText: "web-created-folder" })
  ).toBeVisible({ timeout: 10000 });
});
```

**Step 3: Update "renames item" test**

Replace with SFTP-first confirmation:

```typescript
test("renames item via web, renamed on SFTP server", async ({
  page,
  connectionsPage,
}) => {
  // Navigate to connection
  const card = connectionsPage.getConnectionCard("Test SFTP Server");
  await card.click();
  await page.waitForLoadState("networkidle");

  // Create folder first
  await page.getByRole("button", { name: /add/i }).click();
  await page.getByPlaceholder(/folder name/i).fill("folder-to-rename");
  await page.keyboard.press("Enter");

  // Wait for SFTP to confirm creation
  await waitForSftpPathExists(`${sftpTestConfig.basePath}/folder-to-rename`);

  // Right-click to open context menu
  const folderItem = page
    .getByRole("listitem")
    .filter({ hasText: "folder-to-rename" });
  await folderItem.click({ button: "right" });
  await page.getByRole("menuitem", { name: /rename/i }).click();

  // Rename the folder
  await page.getByRole("textbox").fill("renamed-folder");
  await page.getByRole("button", { name: /^rename$/i }).click();

  // Wait for SFTP to confirm rename (old gone, new exists)
  await waitForSftpPathDeleted(`${sftpTestConfig.basePath}/folder-to-rename`);
  await waitForSftpPathExists(`${sftpTestConfig.basePath}/renamed-folder`);

  // Verify UI updated
  await expect(
    page.getByRole("listitem").filter({ hasText: "renamed-folder" })
  ).toBeVisible({ timeout: 10000 });
});
```

**Step 4: Update "deletes item" test**

Replace with SFTP-first confirmation:

```typescript
test("deletes item via web, removed from SFTP server", async ({
  page,
  connectionsPage,
}) => {
  // Navigate to connection
  const card = connectionsPage.getConnectionCard("Test SFTP Server");
  await card.click();
  await page.waitForLoadState("networkidle");

  // Create folder first
  await page.getByRole("button", { name: /add/i }).click();
  await page.getByPlaceholder(/folder name/i).fill("folder-to-delete");
  await page.keyboard.press("Enter");

  // Wait for SFTP to confirm creation
  await waitForSftpPathExists(`${sftpTestConfig.basePath}/folder-to-delete`);

  // Right-click to open context menu and delete
  const folderItem = page
    .getByRole("listitem")
    .filter({ hasText: "folder-to-delete" });
  await folderItem.click({ button: "right" });
  await page.getByRole("menuitem", { name: /delete/i }).click();

  // Confirm deletion if dialog appears
  const confirmButton = page.getByRole("button", { name: /confirm|delete/i });
  if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await confirmButton.click();
  }

  // Wait for SFTP to confirm deletion
  await waitForSftpPathDeleted(`${sftpTestConfig.basePath}/folder-to-delete`);

  // Verify UI updated
  await expect(folderItem).not.toBeVisible({ timeout: 10000 });
});
```

**Step 5: Run tests to verify**

Run: `BYPASS_RATE_LIMIT=true pnpm exec playwright test --config=e2e/playwright.config.ts --project=chromium -g "Web to SFTP"`
Expected: All tests pass

**Step 6: Commit**

```bash
git add e2e/journeys/sftp/sftp-web-to-server.spec.ts
git commit -m "refactor(e2e): use SFTP wait helpers in web-to-server tests"
```

---

### Task 3: Update SFTP→Web Tests to Use Sync Button Confirmation

**Files:**

- Modify: `e2e/journeys/sftp/sftp-server-to-web.spec.ts`

**Step 1: Create helper for waiting on sync completion**

The sync button shows "Synced" after sync completes. Tests should:

1. Click sync button
2. Wait for button to show "Synced"
3. Then check for items

Update each test to follow this pattern:

```typescript
// Click sync
const syncButton = page.getByRole("button", { name: /^sync$/i });
await expect(syncButton).toBeVisible({ timeout: 10000 });
await syncButton.click();

// Wait for sync to complete (button shows "Synced")
await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
  timeout: 30000,
});

// Now check for items
await expect(
  page.getByRole("listitem").filter({ hasText: "item-name" })
).toBeVisible({ timeout: 10000 });
```

**Step 2: Update all SFTP→Web tests with sync confirmation pattern**

Apply the pattern to all tests in `sftp-server-to-web.spec.ts`.

**Step 3: Run tests to verify**

Run: `BYPASS_RATE_LIMIT=true pnpm exec playwright test --config=e2e/playwright.config.ts --project=chromium -g "SFTP to Web"`
Expected: All tests pass

**Step 4: Commit**

```bash
git add e2e/journeys/sftp/sftp-server-to-web.spec.ts
git commit -m "refactor(e2e): use sync button confirmation in server-to-web tests"
```

---

### Task 4: Update SFTP Sync Tests

**Files:**

- Modify: `e2e/journeys/sftp/sftp-sync.spec.ts`

**Step 1: Apply same patterns to sync tests**

Use the sync button "Synced" confirmation pattern for all sync-related tests.

**Step 2: Run tests to verify**

Run: `BYPASS_RATE_LIMIT=true pnpm exec playwright test --config=e2e/playwright.config.ts --project=chromium -g "SFTP Sync"`
Expected: All tests pass

**Step 3: Commit**

```bash
git add e2e/journeys/sftp/sftp-sync.spec.ts
git commit -m "refactor(e2e): use sync button confirmation in sync tests"
```

---

### Task 5: Run Full E2E Test Suite

**Step 1: Run all SFTP tests**

Run: `BYPASS_RATE_LIMIT=true pnpm exec playwright test --config=e2e/playwright.config.ts --project=chromium -g "SFTP"`
Expected: All tests pass with no flaky tests

**Step 2: Run full E2E suite**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium`
Expected: All tests pass

**Step 3: Final commit**

```bash
git add .
git commit -m "test(e2e): complete SFTP test reliability improvements"
```

---

## Summary

| Test Type       | Wait Strategy                                          |
| --------------- | ------------------------------------------------------ |
| Web→SFTP        | `waitForSftpPathExists()` / `waitForSftpPathDeleted()` |
| SFTP→Web        | Sync button shows "Synced"                             |
| Sync operations | Sync button shows "Synced"                             |

**Key Principles:**

1. Never use arbitrary `waitForTimeout()` calls
2. Poll SFTP server for confirmation before asserting
3. Use sync button state as confirmation for sync operations
4. All wait helpers have configurable timeout and interval
5. Scope listitem locators to `getByTestId('items-tree-view')` to avoid matching toast notifications

**Note:** SFTP tests now run in parallel using isolated per-worker containers (see `docs/plans/2026-01-02-parallel-sftp-containers-design.md`):

```bash
BYPASS_RATE_LIMIT=true pnpm exec playwright test -g "SFTP"
```

## Implementation Status

| Task                              | Status                                                    |
| --------------------------------- | --------------------------------------------------------- |
| 1. Add SFTP wait helper functions | ✅ Complete                                               |
| 2. Update Web→SFTP tests          | ✅ Complete                                               |
| 3. Update SFTP→Web tests          | ✅ Complete                                               |
| 4. Update SFTP Sync tests         | ✅ Complete                                               |
| 5. Run full E2E test suite        | ✅ Complete (parallel execution with isolated containers) |
