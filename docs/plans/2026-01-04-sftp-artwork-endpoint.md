# SFTP Artwork Endpoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable artwork thumbnails for items with SFTP connections by downloading via SFTP (not WebDAV).

**Architecture:** Create a new `/api/artwork/[fileId]` endpoint that downloads artwork files via SFTP using the existing `downloadFileBuffer` function. Update seed to create SFTP connections using real credentials from `.env.local`. WebDAV remains for media streaming only.

**Tech Stack:** Next.js API routes, ssh2-sftp-client, Prisma, Vitest, Playwright

---

## Commit Strategy

> **IMPORTANT:** Do NOT commit after each task. Make ONE commit at the end after ALL tasks are complete and tests pass.

---

## Prerequisites

The seed uses real SFTP credentials from `.env.local`:

```bash
# SFTP Server (Real server for development/testing)
SFTP_SEED_HOST="sftpgo-jacobrees.carol.mygiga.cloud"
SFTP_SEED_PORT="13486"
SFTP_SEED_USERNAME="jacobrees"
SFTP_SEED_PASSWORD="..."
SFTP_SEED_BASE_PATH="/"
```

Ensure these are set before running seed.

---

## Task 1: Create SFTP Artwork API Endpoint

**Files:**

- Create: `app/api/artwork/[fileId]/route.ts`

**Step 1: Create the artwork route file**

```typescript
/**
 * SFTP artwork download route.
 * Downloads artwork files via SFTP for thumbnail display.
 * Unlike /api/stream, does not require WebDAV - uses direct SFTP download.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadFileBuffer } from "@/lib/sftp-client";
import { isValidWebDavPath } from "@/lib/sftp-utils";

/** Cache artwork for 1 hour (immutable content) */
const CACHE_MAX_AGE = 3600;

/** Maximum artwork file size (10MB) to prevent memory issues */
const MAX_ARTWORK_SIZE = 10 * 1024 * 1024;

/**
 * Downloads artwork file via SFTP and serves to client.
 * Returns image with appropriate caching headers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fileId } = await params;

    // Get ItemFile with Item and Connection
    const itemFile = await prisma.itemFile.findUnique({
      where: { id: fileId },
      include: {
        item: {
          include: {
            connection: true,
          },
        },
      },
    });

    if (!itemFile) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Verify ownership
    if (itemFile.item.userId !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Verify file is artwork type
    if (itemFile.fileType !== "ARTWORK") {
      return new NextResponse("Not an artwork file", { status: 400 });
    }

    // Require SFTP connection
    const connection = itemFile.item.connection;
    if (!connection) {
      return new NextResponse("No connection configured", { status: 501 });
    }

    // Validate path security (prevent traversal attacks)
    if (!isValidWebDavPath(itemFile.sftpPath)) {
      console.error("[Artwork] Invalid path:", itemFile.sftpPath);
      return new NextResponse("Invalid file path", { status: 400 });
    }

    // Check file size if known (prevent memory exhaustion)
    if (itemFile.size && Number(itemFile.size) > MAX_ARTWORK_SIZE) {
      console.error("[Artwork] File too large:", itemFile.size);
      return new NextResponse("File too large", { status: 413 });
    }

    // Download via SFTP
    let buffer: Buffer;
    try {
      buffer = await downloadFileBuffer(connection, itemFile.sftpPath);
    } catch (sftpError) {
      const message = sftpError instanceof Error ? sftpError.message : "";

      // Handle specific SFTP errors
      if (message.includes("No such file") || message.includes("not found")) {
        console.error("[Artwork] File not found on SFTP:", itemFile.sftpPath);
        return new NextResponse("File not found on server", { status: 404 });
      }
      if (message.includes("Permission denied")) {
        console.error("[Artwork] Permission denied:", itemFile.sftpPath);
        return new NextResponse("Access denied", { status: 403 });
      }
      if (message.includes("timeout") || message.includes("Timeout")) {
        console.error("[Artwork] Connection timeout");
        return new NextResponse("Connection timeout", { status: 504 });
      }

      // Generic SFTP error
      console.error("[Artwork] SFTP error:", sftpError);
      return new NextResponse("Connection failed", { status: 502 });
    }

    // Verify downloaded size
    if (buffer.length > MAX_ARTWORK_SIZE) {
      console.error("[Artwork] Downloaded file too large:", buffer.length);
      return new NextResponse("File too large", { status: 413 });
    }

    // Build response with caching
    const headers = new Headers();
    headers.set("Content-Type", itemFile.mimeType ?? "image/jpeg");
    headers.set("Content-Length", buffer.length.toString());
    headers.set(
      "Cache-Control",
      `private, max-age=${CACHE_MAX_AGE}, immutable`
    );

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error("[Artwork] Error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
```

**Step 2: Verify file created**

Run: `ls -la app/api/artwork/`
Expected: `[fileId]/route.ts` exists

**Step 3: Type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add app/api/artwork/
git commit -m "feat: add SFTP artwork download endpoint"
```

---

## Task 2: Write Unit Tests for Artwork Endpoint

**Files:**

- Create: `tests/unit/api/artwork-route.test.ts`

**Step 1: Create test file**

```typescript
/**
 * Unit tests for /api/artwork/[fileId] route.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    itemFile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sftp-client", () => ({
  downloadFileBuffer: vi.fn(),
}));

vi.mock("@/lib/sftp-utils", () => ({
  isValidWebDavPath: vi.fn().mockReturnValue(true),
}));

import { GET } from "@/app/api/artwork/[fileId]/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadFileBuffer } from "@/lib/sftp-client";
import { isValidWebDavPath } from "@/lib/sftp-utils";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(prisma.itemFile.findUnique);
const mockDownload = vi.mocked(downloadFileBuffer);
const mockValidPath = vi.mocked(isValidWebDavPath);

function createRequest(fileId: string) {
  return new NextRequest(`http://localhost/api/artwork/${fileId}`);
}

describe("GET /api/artwork/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidPath.mockReturnValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when file not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 403 when user doesn't own item", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "other-user",
        connection: { id: "conn-1" },
      },
    } as any);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(403);
  });

  it("returns 400 when file is not artwork type", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "MEDIA",
      sftpPath: "/media/video.mp4",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as any);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 501 when no connection configured", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      size: null,
      item: {
        userId: "user-1",
        connection: null,
      },
    } as any);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(501);
  });

  it("returns 400 for path traversal attempt", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/../../../etc/passwd",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as any);
    mockValidPath.mockReturnValue(false);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(400);
    expect(mockValidPath).toHaveBeenCalledWith("/../../../etc/passwd");
  });

  it("returns 413 when known file size exceeds limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/huge.jpg",
      mimeType: "image/jpeg",
      size: BigInt(20 * 1024 * 1024), // 20MB
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as any);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(413);
  });

  it("returns image buffer on success", async () => {
    const imageBuffer = Buffer.from("fake-image-data");

    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1", host: "sftp.example.com" },
      },
    } as any);
    mockDownload.mockResolvedValue(imageBuffer);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("max-age=3600");

    const body = await response.arrayBuffer();
    expect(Buffer.from(body)).toEqual(imageBuffer);
  });

  it("returns 404 when SFTP file not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/missing.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as any);
    mockDownload.mockRejectedValue(new Error("No such file"));

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 504 on SFTP timeout", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as any);
    mockDownload.mockRejectedValue(new Error("Operation timeout"));

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(504);
  });

  it("returns 502 on generic SFTP error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as any);
    mockDownload.mockRejectedValue(new Error("Connection reset"));

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(502);
  });
});
```

**Step 2: Run tests**

Run: `pnpm run test:unit tests/unit/api/artwork-route.test.ts`
Expected: All 12 tests PASS

**Step 3: Commit**

```bash
git add tests/unit/api/artwork-route.test.ts
git commit -m "test: add unit tests for artwork endpoint"
```

---

## Task 3: Update Components to Use Artwork Endpoint

**Files:**

- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`

**Step 1: Update GridItem to use /api/artwork**

Change the img src from `/api/stream/` to `/api/artwork/`:

```typescript
// Line ~91: Change from
src={`/api/stream/${artworkId}`}
// To
src={`/api/artwork/${artworkId}`}
```

Also remove any debug console.log statements if present.

**Step 2: Update TreeItem to use /api/artwork**

Change the img src from `/api/stream/` to `/api/artwork/`:

```typescript
// Line ~180: Change from
src={`/api/stream/${artworkId}`}
// To
src={`/api/artwork/${artworkId}`}
```

Also remove any debug console.log statements if present.

**Step 3: Type check**

Run: `pnpm run type-check`
Expected: PASS

**Step 4: Commit**

```bash
git add components/sortable-grid/GridItem.tsx components/sortable-tree/components/TreeItem/TreeItem.tsx
git commit -m "feat: use SFTP artwork endpoint for thumbnails"
```

---

## Task 4: Create Test Artwork Files for Docker SFTP

**Files:**

- Create: `e2e/sftp-data/artwork/test-poster.jpg`
- Modify: `e2e/docker-compose.yml` (if needed to mount artwork folder)

**Step 1: Create test artwork directory**

```bash
mkdir -p e2e/sftp-data/artwork
```

**Step 2: Create a simple test image**

Create a 100x100 placeholder image (or copy a small test image):

```bash
# Option 1: Use ImageMagick if available
convert -size 100x100 xc:blue e2e/sftp-data/artwork/test-poster.jpg

# Option 2: Download a placeholder
curl -o e2e/sftp-data/artwork/test-poster.jpg "https://via.placeholder.com/100x100.jpg"

# Option 3: Copy any small jpg and rename it
```

**Step 3: Verify docker-compose mounts include artwork**

Check `e2e/docker-compose.yml` - the sftp-data folder should already be mounted. If not, add volume mount.

**Step 4: Commit**

```bash
git add e2e/sftp-data/
git commit -m "test: add test artwork for SFTP E2E tests"
```

---

## Task 5: Update Seed to Create SFTP Connection (Required)

**Files:**

- Modify: `prisma/seed.ts`

**Purpose:** Create SFTP connections for seeded users using real credentials from `.env.local` so artwork thumbnails display correctly.

**Step 1: Add helper function for connection creation**

Add after existing helper functions:

```typescript
/**
 * Creates an SFTP connection for a user using env vars.
 * Uses SFTP_SEED_* vars from .env.local.
 */
async function createSftpConnection(userId: string): Promise<string | null> {
  const host = process.env.SFTP_SEED_HOST;
  const username = process.env.SFTP_SEED_USERNAME;
  const password = process.env.SFTP_SEED_PASSWORD;

  if (!host || !username || !password) {
    console.warn("⚠️  SFTP_SEED_* env vars not set - skipping connection");
    return null;
  }

  const { encryptCredential } = await import("@/lib/crypto");
  const encryptedPassword = encryptCredential(password);

  const connection = await prisma.sftpConnection.upsert({
    where: {
      userId_name: { userId, name: "Seed Media Server" },
    },
    update: {
      host,
      port: parseInt(process.env.SFTP_SEED_PORT || "22"),
      username,
      encryptedCredential: encryptedPassword,
      remotePath: process.env.SFTP_SEED_BASE_PATH || "/",
    },
    create: {
      userId,
      name: "Seed Media Server",
      host,
      port: parseInt(process.env.SFTP_SEED_PORT || "22"),
      username,
      encryptedCredential: encryptedPassword,
      remotePath: process.env.SFTP_SEED_BASE_PATH || "/",
      authType: "PASSWORD",
    },
  });

  console.log(`  Created SFTP connection: ${connection.name} -> ${host}`);
  return connection.id;
}
```

**Step 2: Update validateEnvironment to check SFTP config**

Add to end of validateEnvironment():

```typescript
if (process.env.SFTP_SEED_HOST) {
  console.log("✅ SFTP_SEED_* configured - seeded items will have connections");
} else {
  console.warn("⚠️  SFTP_SEED_* not set - seeded items won't display artwork");
}
```

**Step 3: Update createItem to accept connectionId**

Update the createItem function signature to include optional connectionId and sftpPath:

```typescript
async function createItem(
  userId: string,
  name: string,
  parentId: string | null,
  order: number,
  depth: number,
  description?: string,
  connectionId?: string | null,
  sftpPath?: string | null
): Promise<string> {
  const item = await prisma.item.create({
    data: {
      userId,
      name,
      description: description ?? null,
      parentId,
      order,
      depth,
      connectionId: connectionId ?? null,
      sftpPath: sftpPath ?? null,
    },
  });
  return item.id;
}
```

**Step 4: Update main seed function**

After creating each user, create SFTP connection and pass to items:

```typescript
// After creating user
const connectionId = await createSftpConnection(userId);

// Pass connectionId to createItem calls for items that have files
// Example for Movies folder:
const moviesId = await createItem(
  userId,
  "Movies",
  null,
  0,
  0,
  "Feature films and cinema collection.",
  connectionId,
  connectionId ? "/Movies" : null
);
```

**Step 5: Update all createItem calls with SFTP paths**

For each item that has files (movies, TV shows, etc.), pass the connectionId and appropriate sftpPath matching the actual folder structure on the SFTP server.

---

## Task 6: Write Integration Tests

**Files:**

- Create: `tests/integration/artwork/artwork-route.test.ts`

**Step 1: Create integration test**

```typescript
/**
 * Integration tests for artwork endpoint database operations.
 * Tests with real database, mocked SFTP.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { encryptCredential } from "@/lib/crypto";

describe("Artwork Route Integration", () => {
  let userId: string;
  let connectionId: string;
  let itemId: string;
  let artworkFileId: string;
  let mediaFileId: string;
  let itemWithoutConnectionId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `artwork-test-${Date.now()}@example.com`,
        passwordHash: "test-hash",
      },
    });
    userId = user.id;

    // Create test connection
    const connection = await prisma.sftpConnection.create({
      data: {
        userId,
        name: "Test SFTP",
        host: "sftp.test.com",
        port: 22,
        username: "testuser",
        encryptedCredential: encryptCredential("testpass"),
        remotePath: "/media",
        authType: "PASSWORD",
      },
    });
    connectionId = connection.id;

    // Create test item WITH connection
    const item = await prisma.item.create({
      data: {
        userId,
        name: "Test Movie",
        order: 0,
        depth: 0,
        connectionId,
        sftpPath: "/media/movies/test",
      },
    });
    itemId = item.id;

    // Create test item WITHOUT connection
    const itemNoConn = await prisma.item.create({
      data: {
        userId,
        name: "Local Item",
        order: 1,
        depth: 0,
      },
    });
    itemWithoutConnectionId = itemNoConn.id;

    // Create artwork file
    const artworkFile = await prisma.itemFile.create({
      data: {
        itemId,
        filename: "poster.jpg",
        sftpPath: "/media/movies/test/poster.jpg",
        fileType: "ARTWORK",
        mimeType: "image/jpeg",
      },
    });
    artworkFileId = artworkFile.id;

    // Create media file (for negative test)
    const mediaFile = await prisma.itemFile.create({
      data: {
        itemId,
        filename: "movie.mp4",
        sftpPath: "/media/movies/test/movie.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
      },
    });
    mediaFileId = mediaFile.id;
  });

  afterAll(async () => {
    // Cleanup in correct order (foreign key constraints)
    await prisma.itemFile.deleteMany({
      where: { itemId: { in: [itemId, itemWithoutConnectionId] } },
    });
    await prisma.item.deleteMany({ where: { userId } });
    await prisma.sftpConnection.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("retrieves artwork file with connection relationship", async () => {
    const file = await prisma.itemFile.findUnique({
      where: { id: artworkFileId },
      include: {
        item: {
          include: { connection: true },
        },
      },
    });

    expect(file).not.toBeNull();
    expect(file!.fileType).toBe("ARTWORK");
    expect(file!.item.connectionId).toBe(connectionId);
    expect(file!.item.connection).not.toBeNull();
    expect(file!.item.connection!.host).toBe("sftp.test.com");
  });

  it("correctly identifies items without connection", async () => {
    const item = await prisma.item.findUnique({
      where: { id: itemWithoutConnectionId },
      include: { connection: true },
    });

    expect(item).not.toBeNull();
    expect(item!.connection).toBeNull();
  });

  it("correctly identifies non-artwork files", async () => {
    const file = await prisma.itemFile.findUnique({
      where: { id: mediaFileId },
    });

    expect(file).not.toBeNull();
    expect(file!.fileType).toBe("MEDIA");
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm run test:integration tests/integration/artwork/`
Expected: All 3 tests PASS

**Step 3: Commit**

```bash
git add tests/integration/artwork/
git commit -m "test: add integration tests for artwork endpoint"
```

---

## Task 7: Add E2E Test for Artwork Display

**Files:**

- Create: `e2e/journeys/items/items-artwork.spec.ts`

**Step 1: Create E2E test**

```typescript
/**
 * E2E tests for artwork thumbnail display.
 * Tests graceful fallback when artwork unavailable.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Artwork Display", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("artwork");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("items without connection show folder icon instead of broken image", async ({
    page,
    itemsPage,
  }) => {
    // Create item without SFTP connection (will have no artwork)
    await page.getByRole("button", { name: /quick create/i }).click();
    await page.getByLabel(/folder name/i).fill("Local Folder");
    await page.getByRole("button", { name: /^create$/i }).click();

    // Wait for dialog to close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });

    // Verify item is visible
    await itemsPage.expectItemVisible("Local Folder");

    // Should show folder icon, not broken image
    // The folder icon is an SVG inside the item
    const item = page.locator("[data-id]").filter({ hasText: "Local Folder" });
    await expect(item).toBeVisible();

    // Verify no broken images (img elements that failed to load show alt text)
    const brokenImages = item.locator('img[alt=""]');
    const imgCount = await brokenImages.count();

    // If there are img elements, they shouldn't have error state
    // Items without artwork shouldn't even render img elements
    expect(imgCount).toBe(0);
  });

  test("artwork endpoint is called with correct URL pattern", async ({
    page,
  }) => {
    // Monitor network requests to artwork endpoint
    const artworkRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/artwork/")) {
        artworkRequests.push(request.url());
      }
    });

    // Navigate to dashboard (triggers item loading)
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // If any artwork requests were made, verify URL pattern
    for (const url of artworkRequests) {
      expect(url).toMatch(/\/api\/artwork\/[a-z0-9]+$/i);
    }
  });
});
```

**Step 2: Run E2E test**

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium -g "Artwork"`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add e2e/journeys/items/items-artwork.spec.ts
git commit -m "test: add E2E tests for artwork display"
```

---

## Task 8: Clean Up and Revert Temporary Changes

**Files:**

- Modify: `lib/item-actions.ts` (revert webdavUrl check if added)

**Step 1: Ensure item-actions.ts returns artworkId unconditionally**

The `getItems` function should return `artworkId: item.files[0]?.id ?? null` without checking for webdavUrl. The artwork endpoint handles the case where connection is missing.

**Step 2: Run full test suite**

Run: `pnpm run check`
Expected: All checks PASS

**Step 3: Commit cleanup**

```bash
git add lib/item-actions.ts
git commit -m "chore: clean up temporary changes"
```

---

## Task 9: Update Documentation

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add artwork endpoint to documentation**

In the SFTP Connections section, add:

```markdown
- **Artwork thumbnails**: `/api/artwork/[fileId]` downloads via SFTP for display (no WebDAV needed)
- **Media streaming**: `/api/stream/[fileId]` requires WebDAV for seeking support
```

**Step 2: Add optional SEED_SFTP variables**

In Environment Variables section under Optional:

```markdown
Optional (for seeded artwork display):

- `SEED_SFTP_HOST` - SFTP server host for seed data
- `SEED_SFTP_PORT` - SFTP port (default: 22)
- `SEED_SFTP_USERNAME` - SFTP username
- `SEED_SFTP_PASSWORD` - SFTP password
- `SEED_SFTP_PATH` - Remote base path (default: /media)
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add artwork endpoint documentation"
```

---

## Summary

| Task | Description                               | Tests Added |
| ---- | ----------------------------------------- | ----------- |
| 1    | Create `/api/artwork/[fileId]` endpoint   | -           |
| 2    | Unit tests for artwork endpoint           | 12 tests    |
| 3    | Update components to use new endpoint     | -           |
| 4    | Create test artwork files for Docker      | -           |
| 5    | Optional: Update seed for SFTP connection | -           |
| 6    | Integration tests                         | 3 tests     |
| 7    | E2E tests for artwork display             | 2 tests     |
| 8    | Clean up temporary changes                | -           |
| 9    | Update documentation                      | -           |

**Total new tests:** 17 tests (12 unit + 3 integration + 2 E2E)

**Key improvements from review:**

- Added file size limit (10MB) to prevent memory issues
- Specific SFTP error handling (404 vs 502 vs 504)
- Path traversal security test
- Backward-compatible seed changes (optional)
- Clarified test data source (Docker SFTP containers)
