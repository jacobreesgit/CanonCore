# SFTP Complete Implementation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete bidirectional SFTP sync with comprehensive E2E testing against a real SFTP server. This is the final implementation - all functionality will be fully integrated and tested.

**Architecture:** Implement missing sync actions, UI components, and set up Docker SFTP for true end-to-end testing of Web ↔ SFTP operations.

**Tech Stack:** Next.js 16, Prisma 7, ssh2-sftp-client, Vitest, Playwright, Docker (atmoz/sftp)

---

## Current State Audit

### What's Implemented

| Component                                             | Status                    |
| ----------------------------------------------------- | ------------------------- |
| Prisma schema (SftpConnection, Item with SFTP fields) | ✅ Done                   |
| Crypto utilities (AES-256-GCM)                        | ✅ Done                   |
| SFTP client service (connection pooling, mutex)       | ✅ Done                   |
| Connection CRUD actions                               | ✅ Done                   |
| `testSftpConnection` action                           | ✅ Done                   |
| Connection UI (form, card, test button, pages)        | ✅ Done                   |
| `sync-status-badge.tsx`                               | ✅ Built (not integrated) |
| SFTP folder/item actions (`createSftpFolder`, etc.)   | ✅ Built (not integrated) |

### What's Missing

| Component                          | Status                      | Priority |
| ---------------------------------- | --------------------------- | -------- |
| `syncFromSftp` action              | ❌ Not implemented          | HIGH     |
| `uploadToSftp` action              | ❌ Not implemented          | HIGH     |
| `downloadFromSftp` action          | ❌ Not implemented          | HIGH     |
| `sync-button.tsx`                  | ❌ Not built                | HIGH     |
| `sync-progress.tsx` (SSE)          | ❌ Not built                | MEDIUM   |
| `file-upload-dialog.tsx`           | ❌ Not built                | HIGH     |
| `download-button.tsx`              | ❌ Not built                | HIGH     |
| Download API route                 | ❌ Not built                | HIGH     |
| Docker SFTP for testing            | ❌ Not set up               | HIGH     |
| Unit test for `testSftpConnection` | ❌ Missing                  | HIGH     |
| Integration tests for SFTP         | ❌ None exist               | HIGH     |
| E2E tests for actual CRUD          | ❌ Only UI visibility tests | CRITICAL |

### Testing Gaps (Current)

| Layer           | Current State                | Gap                                |
| --------------- | ---------------------------- | ---------------------------------- |
| **Unit**        | 14 tests for connection CRUD | Missing `testSftpConnection`       |
| **Integration** | 0 tests                      | No SFTP integration tests          |
| **E2E**         | 9 tests (UI only)            | No actual CRUD, no SFTP operations |

---

## Architecture

### Bidirectional Sync Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        WEB → SFTP                               │
├─────────────────────────────────────────────────────────────────┤
│  User Action        Server Action         SFTP Server           │
│  ───────────────    ─────────────────     ──────────────        │
│  Create Folder  →   createSftpFolder  →   mkdir on SFTP         │
│  Upload File    →   uploadToSftp      →   put on SFTP           │
│  Rename Item    →   renameSftpItem    →   rename on SFTP        │
│  Delete Item    →   deleteSftpItem    →   rm/rmdir on SFTP      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        SFTP → WEB                               │
├─────────────────────────────────────────────────────────────────┤
│  Trigger             Server Action         Database             │
│  ───────────────     ─────────────────     ──────────────       │
│  Manual Sync     →   syncFromSftp      →   Compare & Update DB  │
│                  →   Detect changes    →   Create/Update/Delete │
│                  →   Conflict detect   →   Mark CONFLICT status │
└─────────────────────────────────────────────────────────────────┘
```

### E2E Test Infrastructure

```
┌─────────────────────────────────────────────────────────────────┐
│                    E2E Test Environment                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │  Playwright  │────▶│  Next.js App │────▶│ Docker SFTP  │    │
│  │  (Browser)   │     │  (localhost) │     │ (atmoz/sftp) │    │
│  └──────────────┘     └──────────────┘     └──────────────┘    │
│         │                    │                    │             │
│         │                    ▼                    │             │
│         │             ┌──────────────┐            │             │
│         │             │  PostgreSQL  │            │             │
│         │             │  (Test DB)   │            │             │
│         │             └──────────────┘            │             │
│         │                                         │             │
│         └─────────── Direct SFTP Access ──────────┘             │
│                    (for verification)                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Part A: Complete Testing Coverage

#### Task 1: Add testSftpConnection Unit Tests

**Files:**

- Modify: `tests/unit/lib/sftp-actions.test.ts`

**Tests to add:**

```typescript
describe("testSftpConnection", () => {
  it("returns error when not authenticated");
  it("returns error when connection not found");
  it("returns latency on successful connection");
  it("updates lastConnectedAt and clears lastError on success");
  it("updates lastError on connection failure");
});
```

#### Task 2: Create SFTP Integration Tests

**Files:**

- Create: `tests/integration/sftp/sftp-connection.test.ts`

**Tests:**

```typescript
describe("SFTP Connection Integration", () => {
  it("creates connection with encrypted credential in DB");
  it("retrieves connection without exposing credential");
  it("updates connection and re-encrypts credential");
  it("deletes connection (items set connectionId to null)");
  it("enforces unique name per user");
});
```

#### Task 3: Fix E2E Tests for Connection CRUD

**Files:**

- Modify: `e2e/journeys/connections/connections-crud.spec.ts`

**Tests to add:**

```typescript
test("creates connection and shows in list");
test("edits existing connection");
test("deletes connection with confirmation");
test("shows error for duplicate name");
```

### Part B: Implement Missing Server Actions

#### Task 4: Implement syncFromSftp Action

**Files:**

- Modify: `lib/sftp-actions.ts`

**Function:**

```typescript
export async function syncFromSftp(
  connectionId: string,
  options?: { onProgress?: (scanned: number, total: number) => void }
): Promise<ActionResult<SyncResult>>;
```

**Logic:**

1. Get connection and verify ownership
2. List SFTP directory recursively (max depth: 10, max files: 10,000)
3. Compare with DB items (by sftpPath)
4. Create new items for files not in DB
5. Update items where mtime differs
6. Mark deleted items as orphaned or delete
7. Detect conflicts (modified both sides since lastSyncedAt)

**Security Limits:**

- Max recursion depth: 10 levels
- Max file count: 10,000 items per sync
- Path traversal prevention via validateSftpPath()

#### Task 5: Implement uploadToSftp Action

**Files:**

- Modify: `lib/sftp-actions.ts`

**Function:**

```typescript
export async function uploadToSftp(
  connectionId: string,
  parentItemId: string | null,
  file: { name: string; buffer: Buffer; mimeType: string }
): Promise<ActionResult<{ id: string }>>;
```

**Limits:**

- 50MB max file size
- Validate filename
- Create Item record with syncStatus: SYNCED

#### Task 6: Implement downloadFromSftp Action + API Route

**Files:**

- Modify: `lib/sftp-actions.ts`
- Create: `app/api/sftp/download/[itemId]/route.ts`

**API Route handles:**

- Small files (≤10MB): Buffer download
- Large files (>10MB): Streaming response

### Part C: Build Missing UI Components

> **For Claude:** Use `frontend-design:frontend-design` skill for Tasks 7-9 to ensure distinctive, production-grade styling.

#### Task 7: Create sync-button.tsx

**Files:**

- Create: `components/sftp/sync-button.tsx`

**Features:**

- Trigger syncFromSftp
- Show loading state with spinning icon
- Display result toast (items synced count)
- Match existing button styling patterns

#### Task 8: Create file-upload-dialog.tsx

**Files:**

- Create: `components/sftp/file-upload-dialog.tsx`

**Features:**

- File picker with drag-drop zone
- Size validation (50MB max) with error toast
- Upload progress indicator
- Call uploadToSftp action
- Match existing dialog patterns (shadcn Dialog)

#### Task 9: Create download-button.tsx

**Files:**

- Create: `components/sftp/download-button.tsx`

**Features:**

- Trigger download via API route
- Handle streaming for large files
- Download icon button (compact for tree/grid items)

#### Task 10: Integrate All SFTP Components into Dashboard

**Files:**

- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `components/items/items-view.tsx`
- Modify: `components/items/add-item-button.tsx`
- Modify: `components/items/item-context-menu.tsx`
- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `components/sortable-grid/GridItem.tsx`

**Integration:**

1. **Sync & Upload (items-view.tsx):**
   - Add sync button to header when viewing SFTP-connected folder
   - Add upload button next to add-item-button

2. **Create Folder (add-item-button.tsx):**
   - When parent folder has sftpConnectionId, call `createSftpFolder` instead of `createItem`
   - This wires up the existing but unused `createSftpFolder` action

3. **Rename & Delete (item-context-menu.tsx):**
   - When item has sftpPath, call `renameSftpItem` instead of `updateItem`
   - When item has sftpPath, call `deleteSftpItem` instead of `deleteItem`
   - This wires up the existing but unused `renameSftpItem` and `deleteSftpItem` actions

4. **Download (TreeItem.tsx, GridItem.tsx):**
   - Add download button to file items (type !== 'folder')
   - Only show for items with sftpPath

5. **SyncStatusBadge (TreeItem.tsx, GridItem.tsx):**
   - Show badge only for items with sftpPath (SFTP-linked items)
   - Badge displays item.syncStatus value

### Part D: E2E Test Infrastructure

#### Task 11: Set Up Docker SFTP for E2E

**Files:**

- Create: `e2e/docker-compose.yml`
- Create: `e2e/global-setup.ts`
- Modify: `e2e/playwright.config.ts`
- Create: `e2e/fixtures/sftp.fixture.ts`

**Docker Compose:**

```yaml
services:
  sftp:
    image: atmoz/sftp
    ports:
      - "2222:22"
    command: testuser:testpass:1001
    volumes:
      - ./sftp-data:/home/testuser/upload
```

**Global Setup (e2e/global-setup.ts):**

```typescript
import { execSync } from "child_process";

export default async function globalSetup() {
  // Start Docker SFTP container before all tests
  execSync("docker-compose -f e2e/docker-compose.yml up -d", {
    stdio: "inherit",
  });

  // Wait for SFTP server to be ready
  await waitForSftpReady();
}

export async function globalTeardown() {
  // Stop Docker SFTP container after all tests
  execSync("docker-compose -f e2e/docker-compose.yml down", {
    stdio: "inherit",
  });
}
```

**Playwright Config Update:**

```typescript
export default defineConfig({
  globalSetup: require.resolve("./global-setup"),
  globalTeardown: require
    .resolve("./global-setup")
    .replace("setup", "teardown"),
  // ... existing config
});
```

**SFTP Verification Fixture (e2e/fixtures/sftp.fixture.ts):**

```typescript
import Client from "ssh2-sftp-client";

export const sftpTestConfig = {
  host: "localhost",
  port: 2222,
  username: "testuser",
  password: "testpass",
  basePath: "/upload",
};

// Direct SFTP client for test verification
export async function verifySftpFileExists(path: string): Promise<boolean> {
  const sftp = new Client();
  try {
    await sftp.connect(sftpTestConfig);
    return (await sftp.exists(path)) !== false;
  } finally {
    await sftp.end();
  }
}

export async function createSftpTestFile(
  path: string,
  content: string
): Promise<void> {
  const sftp = new Client();
  try {
    await sftp.connect(sftpTestConfig);
    await sftp.put(Buffer.from(content), path);
  } finally {
    await sftp.end();
  }
}

export async function deleteSftpTestPath(path: string): Promise<void> {
  const sftp = new Client();
  try {
    await sftp.connect(sftpTestConfig);
    const type = await sftp.exists(path);
    if (type === "d") await sftp.rmdir(path, true);
    else if (type) await sftp.delete(path);
  } finally {
    await sftp.end();
  }
}

export async function listSftpDir(path: string): Promise<string[]> {
  const sftp = new Client();
  try {
    await sftp.connect(sftpTestConfig);
    const files = await sftp.list(path);
    return files.map((f) => f.name);
  } finally {
    await sftp.end();
  }
}
```

#### Task 12: Implement Bidirectional E2E Tests

**Files:**

- Create: `e2e/journeys/sftp/sftp-web-to-server.spec.ts`
- Create: `e2e/journeys/sftp/sftp-server-to-web.spec.ts`
- Create: `e2e/journeys/sftp/sftp-sync.spec.ts`

**Web → SFTP Tests (with SFTP verification):**

```typescript
import { verifySftpFileExists, listSftpDir } from "../../fixtures/sftp.fixture";

test.describe("Web to SFTP", () => {
  test("creates folder via web, exists on SFTP server", async ({ page }) => {
    // Create folder via UI
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByPlaceholder("Folder name").fill("test-folder");
    await page.keyboard.press("Enter");

    // Verify on SFTP server directly
    const exists = await verifySftpFileExists("/upload/test-folder");
    expect(exists).toBe(true);
  });

  test("uploads file via web, exists on SFTP server");
  test("renames item via web, renamed on SFTP server");
  test("deletes item via web, removed from SFTP server");
});
```

**SFTP → Web Tests (with SFTP setup):**

```typescript
import {
  createSftpTestFile,
  deleteSftpTestPath,
} from "../../fixtures/sftp.fixture";

test.describe("SFTP to Web", () => {
  test("file created on SFTP appears in web after sync", async ({ page }) => {
    // Create file directly on SFTP server
    await createSftpTestFile("/upload/remote-file.txt", "Hello from SFTP");

    // Trigger sync via UI
    await page.getByRole("button", { name: "Sync" }).click();
    await page.waitForSelector('[data-testid="sync-complete"]');

    // Verify file appears in web UI
    await expect(page.getByText("remote-file.txt")).toBeVisible();
  });

  test("file modified on SFTP shows updated in web after sync");
  test("file deleted on SFTP removed from web after sync");
  test("new folder on SFTP appears in web after sync");
});
```

**Sync Tests:**

```typescript
test.describe("Sync Operations", () => {
  test("sync button triggers full sync");
  test("sync shows progress");
  test("sync detects conflicts");
  test("sync handles errors gracefully");
});
```

### Part E: Sidebar Reorganization

#### Task 13: Move Connections Under Settings

**Files:**

- Modify: `components/app-sidebar.tsx`
- Possibly modify: `components/nav-secondary.tsx`

**Change:**

```typescript
// Before: Connections as top-level item
// After: Settings > Connections (collapsible)

const dashboardNavSecondary = [
  {
    title: "Settings",
    icon: Settings,
    items: [
      { title: "Connections", url: "/dashboard/connections", icon: Cable },
      { title: "Account", url: "/dashboard/settings/account", icon: User },
    ],
  },
  { title: "Get Help", url: "/docs", icon: HelpCircle },
];
```

### Part F: Cleanup

#### Task 14: Remove Unused Barrel File

**Files:**

- Delete: `components/sftp/index.ts`

---

## Testing Matrix

### Unit Tests

| File                        | Functions Tested         | Mock Strategy                          |
| --------------------------- | ------------------------ | -------------------------------------- |
| `sftp-actions.test.ts`      | All 9 exported functions | Mock Prisma, SFTP client, auth, crypto |
| `sftp-client.test.ts` (new) | Connection pool, mutex   | Mock ssh2-sftp-client                  |
| `crypto.test.ts`            | ✅ Already complete      | N/A                                    |
| `sftp-utils.test.ts`        | ✅ Already complete      | N/A                                    |

### Integration Tests

| File                      | What's Tested    | DB   | SFTP   |
| ------------------------- | ---------------- | ---- | ------ |
| `sftp-connection.test.ts` | Connection CRUD  | Real | Mocked |
| `sftp-items.test.ts`      | Item sync fields | Real | Mocked |

### E2E Tests

| File                         | What's Tested         | DB   | SFTP          |
| ---------------------------- | --------------------- | ---- | ------------- |
| `connections-crud.spec.ts`   | Connection UI flows   | Real | N/A           |
| `sftp-web-to-server.spec.ts` | Web → SFTP operations | Real | Real (Docker) |
| `sftp-server-to-web.spec.ts` | SFTP → Web sync       | Real | Real (Docker) |
| `sftp-sync.spec.ts`          | Sync button, progress | Real | Real (Docker) |

---

## Success Criteria

1. **All unit tests pass** (including new `testSftpConnection` tests)
2. **All integration tests pass** (new SFTP integration tests)
3. **All E2E tests pass** including:
   - Connection CRUD (create/edit/delete verified)
   - Web → SFTP (folder/file operations verified on SFTP)
   - SFTP → Web (sync pulls changes correctly)
4. **Knip passes** with no unused code
5. **Sidebar organized** with Connections under Settings
6. **SyncStatusBadge integrated** into item views
7. **Docker SFTP works** in local dev and CI

---

## CI/CD Considerations

**GitHub Actions changes:**

```yaml
services:
  sftp:
    image: atmoz/sftp
    ports:
      - 2222:22
    options: --name sftp
    env:
      SFTP_USERS: "testuser:testpass:1001"
```

**Environment variables for E2E:**

```bash
SFTP_TEST_HOST=localhost
SFTP_TEST_PORT=2222
SFTP_TEST_USER=testuser
SFTP_TEST_PASS=testpass
SFTP_TEST_PATH=/upload
```

---

## Files Summary

| Action | Path                                                | Description                                      |
| ------ | --------------------------------------------------- | ------------------------------------------------ |
| Modify | `tests/unit/lib/sftp-actions.test.ts`               | Add testSftpConnection tests                     |
| Create | `tests/integration/sftp/sftp-connection.test.ts`    | Integration tests                                |
| Modify | `e2e/journeys/connections/connections-crud.spec.ts` | Fix to test actual CRUD                          |
| Modify | `lib/sftp-actions.ts`                               | Add syncFromSftp, uploadToSftp, downloadFromSftp |
| Create | `app/api/sftp/download/[itemId]/route.ts`           | Streaming download                               |
| Create | `components/sftp/sync-button.tsx`                   | Sync trigger                                     |
| Create | `components/sftp/file-upload-dialog.tsx`            | Upload modal                                     |
| Create | `components/sftp/download-button.tsx`               | Download handler                                 |
| Modify | `components/items/items-view.tsx`                   | Integrate sync/upload buttons                    |
| Modify | `components/items/add-item-button.tsx`              | Use createSftpFolder for SFTP folders            |
| Modify | `components/items/item-context-menu.tsx`            | Use renameSftpItem/deleteSftpItem                |
| Modify | `components/sortable-tree/.../TreeItem.tsx`         | Add SyncStatusBadge, download                    |
| Modify | `components/sortable-grid/GridItem.tsx`             | Add SyncStatusBadge, download                    |
| Modify | `components/app-sidebar.tsx`                        | Reorganize nav                                   |
| Create | `e2e/docker-compose.yml`                            | SFTP test server                                 |
| Create | `e2e/global-setup.ts`                               | Start/stop Docker before/after tests             |
| Modify | `e2e/playwright.config.ts`                          | Add globalSetup/Teardown                         |
| Create | `e2e/fixtures/sftp.fixture.ts`                      | SFTP verification helpers                        |
| Create | `e2e/journeys/sftp/sftp-web-to-server.spec.ts`      | Web→SFTP tests                                   |
| Create | `e2e/journeys/sftp/sftp-server-to-web.spec.ts`      | SFTP→Web tests                                   |
| Create | `e2e/journeys/sftp/sftp-sync.spec.ts`               | Sync tests                                       |
| Delete | `components/sftp/index.ts`                          | Remove unused barrel file                        |

---

## Estimated Scope

| Part                         | Tasks        | Complexity |
| ---------------------------- | ------------ | ---------- |
| A: Complete Testing Coverage | 3            | Medium     |
| B: Server Actions            | 3            | High       |
| C: UI Components             | 4            | Medium     |
| D: E2E Infrastructure        | 2            | High       |
| E: Sidebar Reorg             | 1            | Low        |
| F: Cleanup                   | 1            | Low        |
| **Total**                    | **14 tasks** |            |
