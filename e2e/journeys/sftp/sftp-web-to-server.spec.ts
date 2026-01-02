/**
 * E2E tests for Web to SFTP operations.
 * Verifies that actions in the web UI reflect on the SFTP server.
 * Each worker gets its own isolated SFTP container for parallel execution.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import {
  cleanSftpTestDir,
  waitForSftpPathExists,
  waitForSftpPathDeleted,
} from "../../fixtures/sftp.fixture";

// Skip SFTP tests if Docker is not available
const describeOrSkip = process.env.SKIP_SFTP_TESTS
  ? test.describe.skip
  : test.describe;

describeOrSkip("Web to SFTP Operations", () => {
  test.beforeEach(async ({ page, signUpPage, connectionsPage, sftpConfig }) => {
    // Clean SFTP directory before each test
    try {
      await cleanSftpTestDir(sftpConfig);
    } catch {
      // Ignore if SFTP not available
    }

    // Create user and sign in
    const userEmail = generateUniqueEmail("sftp-web");
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

  test("creates folder via web, exists on SFTP server", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Navigate to connection and sync to initialize
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();

    // Wait for sync to complete
    await page.waitForLoadState("networkidle");

    // Create folder via UI
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/folder name/i).fill("web-created-folder");
    await page.keyboard.press("Enter");

    // Wait for SFTP server to confirm folder exists
    await waitForSftpPathExists(
      `${sftpConfig.basePath}/web-created-folder`,
      sftpConfig
    );

    // Verify folder appears in UI (scope to tree view to avoid matching toast)
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "web-created-folder" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("renames item via web, renamed on SFTP server", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Navigate to connection and sync
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();
    await page.waitForLoadState("networkidle");

    // Scope to tree view to avoid matching toast notifications
    const treeView = page.getByTestId("items-tree-view");

    // Create folder first
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/folder name/i).fill("folder-to-rename");
    await page.keyboard.press("Enter");

    // Wait for SFTP to confirm creation
    await waitForSftpPathExists(
      `${sftpConfig.basePath}/folder-to-rename`,
      sftpConfig
    );

    // Wait for folder to appear in UI
    const folderItem = treeView
      .getByRole("listitem")
      .filter({ hasText: "folder-to-rename" });
    await expect(folderItem).toBeVisible({ timeout: 10000 });

    // Right-click to open context menu
    await folderItem.click({ button: "right" });
    await page.getByRole("menuitem", { name: /rename/i }).click();

    // Rename the folder (following items page object pattern)
    await page.getByRole("textbox").fill("renamed-folder");
    await page.getByRole("button", { name: /^rename$/i }).click();
    // Wait for rename dialog to close
    await expect(page.getByRole("dialog", { name: /rename/i })).not.toBeVisible(
      { timeout: 10000 }
    );

    // Wait for SFTP to confirm rename (old gone, new exists)
    await waitForSftpPathDeleted(
      `${sftpConfig.basePath}/folder-to-rename`,
      sftpConfig
    );
    await waitForSftpPathExists(
      `${sftpConfig.basePath}/renamed-folder`,
      sftpConfig
    );

    // Wait for rename to complete in UI
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "renamed-folder" })
    ).toBeVisible({ timeout: 10000 });
  });

  test("deletes item via web, removed from SFTP server", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Navigate to connection and sync
    const card = connectionsPage.getConnectionCard("Test SFTP Server");
    await card.click();
    await page.waitForLoadState("networkidle");

    // Scope to tree view to avoid matching toast notifications
    const treeView = page.getByTestId("items-tree-view");

    // Create folder first
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByPlaceholder(/folder name/i).fill("folder-to-delete");
    await page.keyboard.press("Enter");

    // Wait for SFTP to confirm creation
    await waitForSftpPathExists(
      `${sftpConfig.basePath}/folder-to-delete`,
      sftpConfig
    );

    // Wait for folder to appear in UI
    const folderItem = treeView
      .getByRole("listitem")
      .filter({ hasText: "folder-to-delete" });
    await expect(folderItem).toBeVisible({ timeout: 10000 });
    await folderItem.click({ button: "right" });
    await page.getByRole("menuitem", { name: /delete/i }).click();

    // Confirm deletion if dialog appears
    const confirmButton = page.getByRole("button", { name: /confirm|delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Wait for deletion to complete in UI
    await expect(folderItem).not.toBeVisible({ timeout: 10000 });

    // Wait for SFTP to confirm deletion
    await waitForSftpPathDeleted(
      `${sftpConfig.basePath}/folder-to-delete`,
      sftpConfig
    );
  });
});
