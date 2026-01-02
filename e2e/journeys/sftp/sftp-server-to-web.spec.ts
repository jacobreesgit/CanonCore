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
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

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
    await expect(page).toHaveURL("/dashboard/connections", { timeout: 10000 });
  });

  test("file created on SFTP appears in web after sync", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create file directly on SFTP server
    await createSftpTestFile(
      `${sftpConfig.basePath}/remote-file.txt`,
      "Hello from SFTP",
      sftpConfig
    );

    // Navigate to connection
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();

    // Click sync button
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete (button shows "Synced")
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Now check for file (scope to tree view to avoid matching toasts)
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "remote-file.txt" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("folder created on SFTP appears in web after sync", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folder directly on SFTP server
    await createSftpTestDir(`${sftpConfig.basePath}/remote-folder`, sftpConfig);

    // Navigate to connection
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();

    // Click sync button
    const syncButton = page.getByRole("button", { name: /^sync$/i });
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
    // Create file on SFTP
    await createSftpTestFile(
      `${sftpConfig.basePath}/file-to-delete.txt`,
      "This will be deleted",
      sftpConfig
    );

    // Navigate and do initial sync
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();

    // Scope to tree view to avoid matching toasts
    const treeView = page.getByTestId("items-tree-view");

    // Click sync button
    let syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete (button shows "Synced")
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Now check for file
    const fileItem = treeView
      .getByRole("listitem")
      .filter({ hasText: "file-to-delete.txt" });
    await expect(fileItem).toBeVisible({ timeout: 10000 });

    // Delete file directly on SFTP
    await deleteSftpTestPath(
      `${sftpConfig.basePath}/file-to-delete.txt`,
      sftpConfig
    );

    // Click sync button again (wait for it to reset to "Sync" state first)
    syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete (button shows "Synced")
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Verify file is removed from web UI
    await expect(fileItem).not.toBeVisible({ timeout: 10000 });
  });

  test("nested structure synced correctly", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create nested structure on SFTP
    await createSftpTestDir(`${sftpConfig.basePath}/parent-folder`, sftpConfig);
    await createSftpTestDir(
      `${sftpConfig.basePath}/parent-folder/child-folder`,
      sftpConfig
    );
    await createSftpTestFile(
      `${sftpConfig.basePath}/parent-folder/child-folder/nested-file.txt`,
      "Nested content",
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

    // Navigate to child folder
    await childFolder.click();
    await page.waitForLoadState("networkidle");

    // Re-select tree view after navigation
    treeView = page.getByTestId("items-tree-view");

    // Verify nested file appears
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "nested-file.txt" })
    ).toBeVisible({ timeout: 10000 });
  });
});
