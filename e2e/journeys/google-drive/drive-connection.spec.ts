/**
 * E2E tests for Google Drive OAuth connection management.
 * Tests connect, disconnect, error states, and Drive links.
 */

import { test, expect, prisma } from "../../fixtures";
import { SettingsPage } from "../../pages/settings.page";
import { ItemsPage } from "../../pages/items.page";
import { encryptCredential } from "@/lib/crypto";

test.describe("Google Drive: OAuth Connection", () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page, testUser }) => {
    settingsPage = new SettingsPage(page);
    await page.goto(`/u/${testUser.username}`);
  });

  test("shows Connect button when not connected", async ({
    page,
    testUser,
  }) => {
    // Ensure no connection exists
    await prisma.googleDriveConnection.deleteMany({
      where: { userId: testUser.id },
    });

    await page.reload();
    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Should show connect button
    await expect(
      page.getByRole("button", { name: /connect google drive/i })
    ).toBeVisible();

    // Should NOT show connected badge
    await expect(page.getByText(/connected/i)).not.toBeVisible();
  });

  test("shows connected state when connection exists", async ({
    page,
    setupDriveConnection,
    testUser,
  }) => {
    await setupDriveConnection(testUser.id);
    await page.reload();

    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Should show connected badge
    await expect(page.getByText("Connected")).toBeVisible();

    // Should NOT show connect button
    await expect(
      page.getByRole("button", { name: /connect google drive/i })
    ).not.toBeVisible();
  });

  test("disconnect removes connection", async ({ page, testUser }) => {
    // Create a FAKE connection with a fake rootFolderId to avoid trashing the real test folder
    // This test only validates the UI disconnect flow, not actual Drive API calls
    await prisma.googleDriveConnection.upsert({
      where: { userId: testUser.id },
      update: {
        isActive: true,
        needsReauth: false,
      },
      create: {
        userId: testUser.id,
        name: "Test Google Drive",
        email: "test@example.com",
        encryptedAccessToken: encryptCredential("fake-token"),
        encryptedRefreshToken: encryptCredential("fake-refresh"),
        accessTokenExpiry: new Date(Date.now() + 3600000),
        rootFolderId: "fake-disconnect-test-folder-id", // Fake ID - won't trash real folder
        isActive: true,
        needsReauth: false,
      },
    });
    await page.reload();

    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Click disconnect (trash icon)
    await settingsPage.clickDisconnect();

    // Confirm in dialog
    await settingsPage.confirmDisconnect();

    // Wait for page to update
    await page.waitForLoadState("networkidle");

    // Should show connect button again
    await expect(
      page.getByRole("button", { name: /connect google drive/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows reconnect badge when token expired", async ({
    page,
    testUser,
  }) => {
    // Create connection with expired token
    await prisma.googleDriveConnection.upsert({
      where: { userId: testUser.id },
      update: {
        accessTokenExpiry: new Date(0),
        needsReauth: true,
        isActive: false,
      },
      create: {
        userId: testUser.id,
        name: "Test Google Drive",
        email: "test@example.com",
        encryptedAccessToken: encryptCredential("expired-token"),
        encryptedRefreshToken: encryptCredential("expired-refresh"),
        accessTokenExpiry: new Date(0),
        rootFolderId: "test-root-folder-id",
        needsReauth: true,
        isActive: false,
      },
    });

    await page.reload();
    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Should show reconnect badge (using locator for the badge specifically)
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: /reconnect/i })
    ).toBeVisible();
  });

  test("rejects invalid OAuth callback", async ({ request }) => {
    // Try to complete OAuth with a tampered state
    const response = await request.get(
      "/api/auth/callback/google-drive?code=test&state=tampered",
      {
        maxRedirects: 0,
      }
    );

    // Should return error status or redirect to error
    const status = response.status();
    expect([400, 401, 302, 307]).toContain(status);
  });

  test("shows Drive folder link in settings after connection", async ({
    page,
    setupDriveConnection,
    testUser,
  }) => {
    await setupDriveConnection(testUser.id);
    await page.reload();

    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Should see the Drive link in settings (rootFolderId set in setupDriveConnection)
    const driveLink = page.getByRole("link", { name: /^drive$/i });
    await expect(driveLink).toBeVisible();
    await expect(driveLink).toHaveAttribute(
      "href",
      expect.stringContaining("drive.google.com/drive/folders/")
    );
    await expect(driveLink).toHaveAttribute("target", "_blank");
  });

  test("shows Open in Drive in context menu for synced items", async ({
    page,
    testUser,
  }) => {
    const itemsPage = new ItemsPage(page, testUser.username);
    await itemsPage.goto();

    // Create an item
    await itemsPage.createItem("Drive Context Menu Test");

    // Manually set driveFileId on the item (simulating sync completion)
    await prisma.item.updateMany({
      where: { userId: testUser.id, name: "Drive Context Menu Test" },
      data: { driveFileId: "test-drive-folder-id" },
    });

    // Refresh to pick up the change and wait for page to fully load
    await page.reload();
    await page.waitForLoadState("networkidle");
    await itemsPage.expectItemVisible("Drive Context Menu Test");

    // Open context menu with retry
    const driveOption = page.getByRole("menuitem", { name: /open in drive/i });
    for (let attempt = 0; attempt < 3; attempt++) {
      await itemsPage.openContextMenu("Drive Context Menu Test");
      try {
        await driveOption.waitFor({ state: "visible", timeout: 2000 });
        break;
      } catch {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        if (attempt === 2) {
          throw new Error("Open in Drive menu item not found after 3 attempts");
        }
      }
    }

    // Should see Open in Drive option with correct link
    await expect(driveOption).toBeVisible();
    await expect(driveOption).toHaveAttribute(
      "href",
      "https://drive.google.com/drive/folders/test-drive-folder-id"
    );
  });

  test("shows trashed folder warning when root folder is in Trash", async ({
    page,
    testUser,
  }) => {
    // Create connection with ROOT_FOLDER_TRASHED error
    await prisma.googleDriveConnection.upsert({
      where: { userId: testUser.id },
      update: {
        lastError: "ROOT_FOLDER_TRASHED",
        isActive: true,
        needsReauth: false,
      },
      create: {
        userId: testUser.id,
        name: "Test Google Drive",
        email: "test@example.com",
        encryptedAccessToken: encryptCredential("test-token"),
        encryptedRefreshToken: encryptCredential("test-refresh"),
        accessTokenExpiry: new Date(Date.now() + 3600000),
        rootFolderId: "trashed-folder-id",
        lastError: "ROOT_FOLDER_TRASHED",
        isActive: true,
        needsReauth: false,
      },
    });

    await page.reload();
    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Should show trashed folder warning
    await expect(page.getByText("CanonCore folder is in Trash")).toBeVisible();

    // Should show Restore in Drive link
    const restoreLink = page.getByRole("link", { name: /restore in drive/i });
    await expect(restoreLink).toBeVisible();
    await expect(restoreLink).toHaveAttribute(
      "href",
      "https://drive.google.com/drive/folders/trashed-folder-id"
    );

    // Should NOT show the normal Drive link in action bar
    await expect(
      page.getByRole("link", { name: /^drive$/i })
    ).not.toBeVisible();
  });

  test("shows deleted folder warning when root folder was permanently deleted", async ({
    page,
    testUser,
  }) => {
    // Create connection with ROOT_FOLDER_DELETED error
    await prisma.googleDriveConnection.upsert({
      where: { userId: testUser.id },
      update: {
        lastError: "ROOT_FOLDER_DELETED",
        isActive: true,
        needsReauth: false,
      },
      create: {
        userId: testUser.id,
        name: "Test Google Drive",
        email: "test@example.com",
        encryptedAccessToken: encryptCredential("test-token"),
        encryptedRefreshToken: encryptCredential("test-refresh"),
        accessTokenExpiry: new Date(Date.now() + 3600000),
        rootFolderId: "deleted-folder-id",
        lastError: "ROOT_FOLDER_DELETED",
        isActive: true,
        needsReauth: false,
      },
    });

    await page.reload();
    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Should show deleted folder warning
    await expect(page.getByText("CanonCore folder was deleted")).toBeVisible();

    // Should show instruction to disconnect and reconnect
    await expect(page.getByText(/disconnect and reconnect/i)).toBeVisible();

    // Should NOT show Restore link (folder is permanently deleted)
    await expect(
      page.getByRole("link", { name: /restore in drive/i })
    ).not.toBeVisible();

    // Should NOT show the normal Drive link in action bar
    await expect(
      page.getByRole("link", { name: /^drive$/i })
    ).not.toBeVisible();
  });

  test("displays storage quota in settings when quota data exists", async ({
    page,
    testUser,
  }) => {
    // Create connection with quota data
    await prisma.googleDriveConnection.upsert({
      where: { userId: testUser.id },
      update: {
        quotaBytesUsed: BigInt("8053063680"), // 7.5 GB
        quotaBytesTotal: BigInt("16106127360"), // 15 GB
        isActive: true,
        needsReauth: false,
        lastError: null,
      },
      create: {
        userId: testUser.id,
        name: "Test Google Drive",
        email: "test@example.com",
        encryptedAccessToken: encryptCredential("test-token"),
        encryptedRefreshToken: encryptCredential("test-refresh"),
        accessTokenExpiry: new Date(Date.now() + 3600000),
        rootFolderId: "test-folder-id",
        quotaBytesUsed: BigInt("8053063680"), // 7.5 GB
        quotaBytesTotal: BigInt("16106127360"), // 15 GB
        isActive: true,
        needsReauth: false,
      },
    });

    await page.reload();
    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Scope to settings dialog to avoid strict mode violation on mobile
    // (mobile has both user sheet and settings dialog visible)
    const dialog = page.locator('[role="dialog"][data-slot="dialog-content"]');

    // Wait for storage label to be visible (AnimatedDialogContent needs time to render)
    await expect(dialog.getByText("Storage", { exact: true })).toBeVisible();

    // Verify storage bar shows usage data
    await expect(dialog.getByRole("progressbar")).toBeVisible();
    await expect(
      dialog.getByText(/\d+\.?\d* GB \/ \d+\.?\d* GB/)
    ).toBeVisible();

    // Verify Manage Storage link points to Google One storage
    const manageLink = dialog.getByRole("link", { name: /manage storage/i });
    await expect(manageLink).toBeVisible();
    await expect(manageLink).toHaveAttribute(
      "href",
      "https://one.google.com/storage"
    );
  });

  test("shows disabled storage section when quota data is null", async ({
    page,
    testUser,
  }) => {
    // Create connection WITHOUT quota data
    await prisma.googleDriveConnection.upsert({
      where: { userId: testUser.id },
      update: {
        quotaBytesUsed: null,
        quotaBytesTotal: null,
        isActive: true,
        needsReauth: false,
        lastError: null,
      },
      create: {
        userId: testUser.id,
        name: "Test Google Drive",
        email: "test@example.com",
        encryptedAccessToken: encryptCredential("test-token"),
        encryptedRefreshToken: encryptCredential("test-refresh"),
        accessTokenExpiry: new Date(Date.now() + 3600000),
        rootFolderId: "test-folder-id",
        quotaBytesUsed: null,
        quotaBytesTotal: null,
        isActive: true,
        needsReauth: false,
      },
    });

    await page.reload();
    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Scope to settings dialog to avoid strict mode violation on mobile
    // (mobile has both user sheet and settings dialog visible)
    const dialog = page.locator('[role="dialog"][data-slot="dialog-content"]');

    // Wait for storage label to be visible (AnimatedDialogContent needs time to render)
    await expect(dialog.getByText("Storage", { exact: true })).toBeVisible();

    // Storage section is always shown, but displays "Sync to see storage usage" when no data
    await expect(dialog.getByText("Sync to see storage usage")).toBeVisible();

    // Progress bar is rendered but with reduced opacity (still visible to Playwright)
    await expect(dialog.getByRole("progressbar")).toBeVisible();

    // Manage Storage link is always visible
    await expect(
      dialog.getByRole("link", { name: /manage storage/i })
    ).toBeVisible();
  });
});
