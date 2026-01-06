/**
 * E2E tests for SFTP to Web operations.
 * Verifies that changes on SFTP server appear in web UI after sync.
 * Each worker gets its own isolated SFTP container for parallel execution.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import {
  createSftpTestFile,
  createSftpTestDir,
  deleteSftpTestPath,
  cleanSftpTestDir,
} from "../../fixtures/sftp.fixture";

// Skip SFTP tests if Docker is not available
const describeOrSkip = process.env.SKIP_SFTP_TESTS
  ? test.describe.skip
  : test.describe;

describeOrSkip("SFTP to Web Operations", () => {
  test.beforeEach(async ({ page, signUpPage, connectionsPage, sftpConfig }) => {
    // Clean SFTP directory before each test
    try {
      await cleanSftpTestDir(sftpConfig);
    } catch {
      // Ignore if SFTP not available
    }

    // Create user and sign in
    const userEmail = generateUniqueEmail("sftp-sync");
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

  test("file created on SFTP appears in web after sync", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folder with file on SFTP server (files are ItemFiles attached to folders)
    const folderPath = `${sftpConfig.basePath}/RemoteFolder`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestFile(
      `${folderPath}/remote-file.mp4`,
      "Hello from SFTP",
      sftpConfig
    );

    // Navigate to my-items page
    await page.goto("/my-items");

    // With single connection, filter auto-selects it
    await expect(page.getByRole("combobox")).toContainText("Test SFTP Server");

    // Click Sync Connection button (single connection auto-selected)
    const syncButton = page.getByRole("button", { name: /sync connection/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete (button shows "Synced")
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Folder appears in tree
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "RemoteFolder" })
    ).toBeVisible({ timeout: 10000 });

    // Click folder to see hero with file count
    await treeView
      .getByRole("listitem")
      .filter({ hasText: "RemoteFolder" })
      .click();

    // Hero shows folder name and media file count
    await expect(page.getByTestId("item-hero")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "RemoteFolder"
    );
    await expect(page.getByText("1 media file")).toBeVisible();
  });

  test("folder created on SFTP appears in web after sync", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folder directly on SFTP server
    await createSftpTestDir(`${sftpConfig.basePath}/remote-folder`, sftpConfig);

    // Navigate to my-items page
    await page.goto("/my-items");

    // With single connection, filter auto-selects it
    await expect(page.getByRole("combobox")).toContainText("Test SFTP Server");

    // Click Sync Connection button (single connection auto-selected)
    const syncButton = page.getByRole("button", { name: /sync connection/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete (button shows "Synced")
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Now check for folder (scope to tree view to avoid matching toasts)
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "remote-folder" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("file deleted on SFTP removed from web after sync", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folder with file on SFTP (files are ItemFiles attached to folders)
    const folderPath = `${sftpConfig.basePath}/DeleteFolder`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestFile(
      `${folderPath}/file-to-delete.mp4`,
      "This will be deleted",
      sftpConfig
    );

    // Navigate to my-items page
    await page.goto("/my-items");

    // With single connection, filter auto-selects it
    await expect(page.getByRole("combobox")).toContainText("Test SFTP Server");

    // Click Sync Connection button (single connection auto-selected)
    let syncButton = page.getByRole("button", { name: /sync connection/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete (button shows "Synced")
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Scope to tree view to avoid matching toasts
    const treeView = page.getByTestId("items-tree-view");

    // Folder appears in tree
    const folderItem = treeView
      .getByRole("listitem")
      .filter({ hasText: "DeleteFolder" });
    await expect(folderItem).toBeVisible({ timeout: 10000 });

    // Click folder to see hero with file count
    await folderItem.click();
    await expect(page.getByTestId("item-hero")).toBeVisible();
    await expect(page.getByText("1 media file")).toBeVisible();

    // Delete file directly on SFTP
    await deleteSftpTestPath(`${folderPath}/file-to-delete.mp4`, sftpConfig);

    // Go back and sync again
    await page.goBack();
    syncButton = page.getByRole("button", { name: /sync connection/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete (button shows "Synced")
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Click folder again - hero should show no media files
    await folderItem.click();
    await expect(page.getByTestId("item-hero")).toBeVisible();
    await expect(page.getByText(/media file/)).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("nested structure synced correctly", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create nested structure on SFTP (files are ItemFiles in folders)
    await createSftpTestDir(`${sftpConfig.basePath}/parent-folder`, sftpConfig);
    await createSftpTestDir(
      `${sftpConfig.basePath}/parent-folder/child-folder`,
      sftpConfig
    );
    await createSftpTestFile(
      `${sftpConfig.basePath}/parent-folder/child-folder/nested-file.mp4`,
      "Nested content",
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

    // Scope to tree view to avoid matching toasts
    let treeView = page.getByTestId("items-tree-view");

    // Wait for parent folder to appear
    const parentFolder = treeView
      .getByRole("listitem")
      .filter({ hasText: "parent-folder" });
    await expect(parentFolder).toBeVisible({ timeout: 10000 });

    // Navigate to parent folder
    await parentFolder.click();
    await page.waitForLoadState("networkidle");

    // Re-select tree view after navigation
    treeView = page.getByTestId("items-tree-view");

    // Verify child folder appears
    const childFolder = treeView
      .getByRole("listitem")
      .filter({ hasText: "child-folder" });
    await expect(childFolder).toBeVisible({ timeout: 10000 });

    // Navigate to child folder - should show hero with file count
    await childFolder.click();
    await page.waitForLoadState("networkidle");

    // Verify hero shows folder name and media file count
    await expect(page.getByTestId("item-hero")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "child-folder"
    );
    await expect(page.getByText("1 media file")).toBeVisible();
  });
});
