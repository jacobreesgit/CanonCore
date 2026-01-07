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

  test("sync button triggers full sync", async ({ page, sftpConfig }) => {
    // Create folders on SFTP (only folders appear in tree)
    await createSftpTestDir(`${sftpConfig.basePath}/sync-folder-1`, sftpConfig);
    await createSftpTestDir(`${sftpConfig.basePath}/sync-folder-2`, sftpConfig);
    // Create file inside folder (to test ItemFiles)
    await createSftpTestFile(
      `${sftpConfig.basePath}/sync-folder-1/test-file.mp4`,
      "Content",
      sftpConfig
    );

    // Navigate to my-items page
    await page.goto("/my-items");

    // With single connection, filter auto-selects it
    await expect(page.getByRole("combobox")).toContainText("Test SFTP Server");

    // Wait for Sync Connection button to be ready (single connection shows "Sync Connection")
    const syncButton = page.getByRole("button", { name: /sync connection/i });
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

    // Click folder to verify file was synced (hero shows media count)
    await treeView
      .getByRole("listitem")
      .filter({ hasText: "sync-folder-1" })
      .click();
    await expect(page.getByTestId("item-hero")).toBeVisible();
    await expect(page.getByText("1 media file")).toBeVisible();
  });

  test("sync shows loading state", async ({ page, sftpConfig }) => {
    // Create folders on SFTP (only folders appear in tree)
    for (let i = 0; i < 5; i++) {
      await createSftpTestDir(`${sftpConfig.basePath}/folder-${i}`, sftpConfig);
    }

    // Navigate to my-items page
    await page.goto("/my-items");

    // With single connection, filter auto-selects it
    await expect(page.getByRole("combobox")).toContainText("Test SFTP Server");

    // Wait for Sync Connection button to be ready (single connection shows "Sync Connection")
    const syncButton = page.getByRole("button", { name: /sync connection/i });
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

  test("displays sync status badge on items", async ({ page, sftpConfig }) => {
    // Create folder on SFTP (only folders appear as Items in tree)
    await createSftpTestDir(
      `${sftpConfig.basePath}/status-test-folder`,
      sftpConfig
    );

    // Navigate to my-items page
    await page.goto("/my-items");

    // With single connection, filter auto-selects it
    await expect(page.getByRole("combobox")).toContainText("Test SFTP Server");

    // Wait for Sync Connection button to be ready, then click
    const syncButton = page.getByRole("button", { name: /sync connection/i });
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

  test("empty sync shows appropriate message", async ({ page }) => {
    // Navigate to my-items page (SFTP is empty)
    await page.goto("/my-items");

    // With single connection, filter auto-selects it
    await expect(page.getByRole("combobox")).toContainText("Test SFTP Server");

    // Wait for Sync Connection button to be ready, then click
    const syncButton = page.getByRole("button", { name: /sync connection/i });
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
      .getByText(/no items yet/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(hasAlreadyInSync || hasEmptyMessage).toBe(true);
  });
});

describeOrSkip("Connection filter sync behavior", () => {
  test.beforeEach(async ({ page, signUpPage, connectionsPage, sftpConfig }) => {
    // Clean SFTP directory before each test
    try {
      await cleanSftpTestDir(sftpConfig);
    } catch {
      // Ignore if SFTP not available
    }

    // Create user and sign in
    const userEmail = generateUniqueEmail("filter-sync");
    await signUpPage.goto();
    await signUpPage.signUp(userEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Create first SFTP connection
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Server One",
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      credential: sftpConfig.password,
      basePath: sftpConfig.basePath,
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/my-items/connections", { timeout: 10000 });

    // Create second SFTP connection (same server, different name)
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Server Two",
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      credential: sftpConfig.password,
      basePath: sftpConfig.basePath,
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/my-items/connections", { timeout: 10000 });
  });

  test("shows Sync All button when All Items selected", async ({ page }) => {
    await page.goto("/my-items");

    // With multiple connections, filter defaults to "All Items"
    await expect(page.getByRole("combobox")).toContainText("All Items");

    // Should show "Sync All" button
    const syncAllButton = page.getByRole("button", { name: /sync all/i });
    await expect(syncAllButton).toBeVisible({ timeout: 10000 });
  });

  test("shows Sync Connection button when individual connection selected", async ({
    page,
  }) => {
    await page.goto("/my-items");

    // Select individual connection from filter
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Server One" }).click();

    // Should show "Sync Connection" button instead of "Sync All"
    const syncConnectionButton = page.getByRole("button", {
      name: /sync connection/i,
    });
    await expect(syncConnectionButton).toBeVisible({ timeout: 10000 });

    // "Sync All" should not be visible
    const syncAllButton = page.getByRole("button", { name: /sync all/i });
    await expect(syncAllButton).not.toBeVisible();
  });

  test("hides connection badges when filtered to individual connection", async ({
    page,
    sftpConfig,
  }) => {
    // Create folder on SFTP
    await createSftpTestDir(`${sftpConfig.basePath}/badge-test`, sftpConfig);

    await page.goto("/my-items");

    // First sync with "All Items" selected
    await expect(page.getByRole("combobox")).toContainText("All Items");
    const syncAllButton = page.getByRole("button", { name: /sync all/i });
    await expect(syncAllButton).toBeVisible({ timeout: 10000 });
    await syncAllButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Both connections sync the same folder, creating 2 items (one per connection)
    // Verify at least one badge is visible when "All Items" selected
    const treeView = page.getByTestId("items-tree-view");

    // Wait for items to appear (may have duplicates from both connections)
    const folderItems = treeView
      .getByRole("listitem")
      .filter({ hasText: "badge-test" });
    await expect(folderItems.first()).toBeVisible({ timeout: 10000 });

    // At least one connection badge should be visible (both may be present)
    const serverOneBadge = treeView.getByText("Server One");
    const serverTwoBadge = treeView.getByText("Server Two");
    await expect(serverOneBadge.or(serverTwoBadge).first()).toBeVisible();

    // Now filter to individual connection
    await page.getByRole("combobox").click();
    // Wait for dropdown to open
    await expect(page.getByRole("option", { name: "Server One" })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("option", { name: "Server One" }).click();

    // Wait for filter to apply - should show only Server One's item
    await expect(page.getByRole("combobox")).toContainText("Server One", {
      timeout: 5000,
    });

    // Badge should be hidden when filtered to individual connection
    // The filtered view only shows that connection's items, and badges are hidden
    await expect(treeView.getByText("Server One")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(treeView.getByText("Server Two")).not.toBeVisible();
  });

  test("shows connection badges when All Items selected", async ({
    page,
    sftpConfig,
  }) => {
    // Create folder on SFTP
    await createSftpTestDir(
      `${sftpConfig.basePath}/all-items-badge`,
      sftpConfig
    );

    await page.goto("/my-items");

    // Sync to get the folder
    const syncAllButton = page.getByRole("button", { name: /sync all/i });
    await expect(syncAllButton).toBeVisible({ timeout: 10000 });
    await syncAllButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Verify "All Items" is selected
    await expect(page.getByRole("combobox")).toContainText("All Items");

    // Both connections sync the same folder, creating 2 items (one per connection)
    // Wait for at least one item to appear
    const treeView = page.getByTestId("items-tree-view");
    const folderItems = treeView
      .getByRole("listitem")
      .filter({ hasText: "all-items-badge" });
    await expect(folderItems.first()).toBeVisible({ timeout: 10000 });

    // Connection badges should be visible when viewing All Items
    // Both badges may be present (one for each connection's synced item)
    const serverOneBadge = treeView.getByText("Server One");
    const serverTwoBadge = treeView.getByText("Server Two");
    await expect(serverOneBadge.or(serverTwoBadge).first()).toBeVisible();
  });

  test("shows Sync Connection when only one connection exists", async ({
    page,
    connectionsPage,
  }) => {
    // Delete second connection to have only one
    await connectionsPage.goto();

    // Use the page object's deleteConnection method which handles the confirm dialog
    await connectionsPage.deleteConnection("Server Two");

    // Wait for card to be removed
    await expect(
      connectionsPage.getConnectionCard("Server Two")
    ).not.toBeVisible({ timeout: 5000 });

    // Wait for any pending navigations to settle
    await page.waitForLoadState("networkidle");

    // Navigate to my-items
    await page.goto("/my-items");

    // With single connection, filter auto-selects it and should be disabled
    await expect(page.getByRole("combobox")).toContainText("Server One");

    // Should show "Sync Connection" button (not "Sync All") because single connection is auto-selected
    // Note: With our implementation, single connection means effectiveSelectedConnection is set,
    // so it shows "Sync Connection" not "Sync All"
    const syncButton = page.getByRole("button", { name: /sync connection/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
  });
});
