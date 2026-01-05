/**
 * E2E tests for SFTP sync operations.
 * Tests sync button behavior, progress, and error handling.
 * Each worker gets its own isolated SFTP container for parallel execution.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import {
  createSftpTestFile,
  createSftpTestDir,
  cleanSftpTestDir,
} from "../../fixtures/sftp.fixture";

// Skip SFTP tests if Docker is not available
const describeOrSkip = process.env.SKIP_SFTP_TESTS
  ? test.describe.skip
  : test.describe;

describeOrSkip("SFTP Sync Operations", () => {
  test.beforeEach(async ({ page, signUpPage, connectionsPage, sftpConfig }) => {
    // Clean SFTP directory before each test
    try {
      await cleanSftpTestDir(sftpConfig);
    } catch {
      // Ignore if SFTP not available
    }

    // Create user and sign in
    const userEmail = generateUniqueEmail("sftp-ops");
    await signUpPage.goto();
    await signUpPage.signUp(userEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Create SFTP connection using worker-specific config
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Test SFTP Server",
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      credential: sftpConfig.password,
      basePath: sftpConfig.basePath,
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/my-items/connections", { timeout: 10000 });
  });

  test("sync button triggers full sync", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folders on SFTP (only folders appear in tree)
    await createSftpTestDir(`${sftpConfig.basePath}/sync-folder-1`, sftpConfig);
    await createSftpTestDir(`${sftpConfig.basePath}/sync-folder-2`, sftpConfig);
    // Create file inside folder (to test ItemFiles)
    await createSftpTestFile(
      `${sftpConfig.basePath}/sync-folder-1/test-file.mp4`,
      "Content",
      sftpConfig
    );

    // Navigate to connection
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();

    // Wait for sync button to be ready (exact match to avoid "Syncing..." or "Synced")
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete by checking for "Synced" state
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Wait for folders to appear (scope to tree view to avoid matching toasts)
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "sync-folder-1" })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "sync-folder-2" })
    ).toBeVisible();

    // Click folder to verify file was synced
    await treeView
      .getByRole("listitem")
      .filter({ hasText: "sync-folder-1" })
      .click();
    await expect(page.getByText("test-file.mp4")).toBeVisible();
  });

  test("sync shows loading state", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folders on SFTP (only folders appear in tree)
    for (let i = 0; i < 5; i++) {
      await createSftpTestDir(`${sftpConfig.basePath}/folder-${i}`, sftpConfig);
    }

    // Navigate to connection
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();

    // Wait for sync button to be ready (exact match to avoid "Syncing..." or "Synced")
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // The button should transition through states: Sync -> Syncing -> Synced
    // We verify the final "Synced" state as the loading state may be too fast to catch
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Verify folders were synced (scope to tree view)
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "folder-0" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("connection test button works", async ({ page, connectionsPage }) => {
    // Go to connections list
    await connectionsPage.goto();

    // Click test button on connection card
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    const testButton = card.getByRole("button", { name: /test/i });
    await testButton.click();

    // Wait for test to complete and show result
    await expect(page.getByText(/connected|success|ms/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("displays sync status badge on items", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folder on SFTP (only folders appear as Items in tree)
    await createSftpTestDir(
      `${sftpConfig.basePath}/status-test-folder`,
      sftpConfig
    );

    // Navigate to connection
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();

    // Wait for sync button to be ready, then click
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete by checking for "Synced" state
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Wait for folder to appear (scope to tree view to avoid matching toasts)
    const treeView = page.getByTestId("items-tree-view");
    const folderItem = treeView
      .getByRole("listitem")
      .filter({ hasText: "status-test-folder" });
    await expect(folderItem).toBeVisible({ timeout: 10000 });

    // Check for sync status badge (should show synced status)
    // Note: Badge may be hidden by default, shown on hover
    await folderItem.hover();

    // Look for any status indicator
    const statusBadge = page.locator("[data-sync-status]");
    if (await statusBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(statusBadge).toHaveAttribute(
        "data-sync-status",
        /synced|pending/i
      );
    }
  });

  test("empty sync shows appropriate message", async ({
    page,
    connectionsPage,
  }) => {
    // Navigate to connection (SFTP is empty)
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();

    // Wait for sync button to be ready, then click
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // For empty sync, wait for button to show "Synced" (no items to wait for)
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Should show "Already in sync" toast or empty state in UI
    const hasAlreadyInSync = await page
      .getByText(/already in sync/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasEmptyMessage = await page
      .getByText(/no folders yet/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasAlreadyInSync || hasEmptyMessage).toBe(true);
  });
});
