/**
 * E2E tests for media file display and playback.
 * Tests item detail view with media files, artwork, and subtitles.
 * Each worker gets its own isolated SFTP container for parallel execution.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import {
  createSftpTestFile,
  createSftpTestImage,
  createSftpTestSubtitle,
  createSftpTestDir,
  cleanSftpTestDir,
  waitForSftpDirContains,
} from "../../fixtures/sftp.fixture";
import { MediaPage } from "../../pages/media.page";

// Skip SFTP tests if Docker is not available
const describeOrSkip = process.env.SKIP_SFTP_TESTS
  ? test.describe.skip
  : test.describe;

describeOrSkip("Media Playback", () => {
  let mediaPage: MediaPage;

  test.beforeEach(async ({ page, signUpPage, connectionsPage, sftpConfig }) => {
    mediaPage = new MediaPage(page);

    // Clean SFTP directory before each test
    try {
      await cleanSftpTestDir(sftpConfig);
    } catch {
      // Ignore if SFTP not available
    }

    // Create user and sign in
    const userEmail = generateUniqueEmail("media");
    await signUpPage.goto();
    await signUpPage.signUp(userEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Create SFTP connection using worker-specific config
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Media Server",
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      credential: sftpConfig.password,
      basePath: sftpConfig.basePath,
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/my-items/connections", { timeout: 10000 });
  });

  test("syncs and displays media files in item detail", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create a folder with media files on SFTP
    const folderPath = `${sftpConfig.basePath}/Movie`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestFile(
      `${folderPath}/video.mp4`,
      "fake video content",
      sftpConfig
    );
    await createSftpTestImage(`${folderPath}/poster.jpg`, sftpConfig);
    await createSftpTestSubtitle(`${folderPath}/subtitles.srt`, sftpConfig);

    // Navigate to my-items - with single connection, filter auto-selects it
    await page.goto("/my-items");
    await expect(page.getByRole("combobox")).toContainText("Media Server");

    // Wait for Sync All button and click (single connection, filter auto-selects)
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();

    // Wait for sync to complete
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Wait for Movie item to appear (scope to tree view)
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "Movie" })
    ).toBeVisible({ timeout: 10000 });

    // Click on Movie item to see item detail
    await treeView.getByRole("listitem").filter({ hasText: "Movie" }).click();

    // Verify item detail shows files
    await mediaPage.expectHeroWithTitle("Movie");
    await mediaPage.expectMediaFile("video.mp4");
    await mediaPage.expectSubtitleFile("subtitles.srt");
    await mediaPage.expectArtworkCount(1);
  });

  test("shows play button for media files", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create a folder with a video file
    const folderPath = `${sftpConfig.basePath}/Episode`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestFile(
      `${folderPath}/episode.mp4`,
      "video content",
      sftpConfig
    );

    // Navigate to my-items - with single connection, filter auto-selects it
    await page.goto("/my-items");
    await expect(page.getByRole("combobox")).toContainText("Media Server");
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Navigate to Episode folder
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "Episode" })
    ).toBeVisible({ timeout: 10000 });
    await treeView.getByRole("listitem").filter({ hasText: "Episode" }).click();

    // Verify play button exists
    await mediaPage.expectHeroWithTitle("Episode");
    const playButton = page.getByRole("button", { name: /^play$/i });
    await expect(playButton).toBeVisible();
  });

  test("opens media overlay when clicking play", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create a folder with a video file
    const folderPath = `${sftpConfig.basePath}/Show`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestFile(
      `${folderPath}/episode.mkv`,
      "video content",
      sftpConfig
    );

    // Navigate to my-items - with single connection, filter auto-selects it
    await page.goto("/my-items");
    await expect(page.getByRole("combobox")).toContainText("Media Server");
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Navigate to Show folder
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "Show" })
    ).toBeVisible({ timeout: 10000 });
    await treeView.getByRole("listitem").filter({ hasText: "Show" }).click();

    // Click play button
    await mediaPage.clickPlayButton("episode.mkv");

    // Verify media overlay opens
    await mediaPage.expectMediaOverlayVisible();
  });

  test("closes media overlay with close button", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create a folder with a video file
    const folderPath = `${sftpConfig.basePath}/Content`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestFile(`${folderPath}/content.mp4`, "video", sftpConfig);

    // Navigate to my-items - with single connection, filter auto-selects it
    await page.goto("/my-items");
    await expect(page.getByRole("combobox")).toContainText("Media Server");
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Navigate to folder and open player
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "Content" })
    ).toBeVisible({ timeout: 10000 });
    await treeView.getByRole("listitem").filter({ hasText: "Content" }).click();

    await mediaPage.clickPlayButton("content.mp4");
    await mediaPage.expectMediaOverlayVisible();

    // Close overlay
    await mediaPage.closeMediaOverlay();
    await mediaPage.expectMediaOverlayNotVisible();
  });

  test("shows download button for files", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create a folder with a video file
    const folderPath = `${sftpConfig.basePath}/Downloads`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestFile(`${folderPath}/download.mp4`, "video", sftpConfig);

    // Navigate to my-items - with single connection, filter auto-selects it
    await page.goto("/my-items");
    await expect(page.getByRole("combobox")).toContainText("Media Server");
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Navigate to folder
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "Downloads" })
    ).toBeVisible({ timeout: 10000 });
    await treeView
      .getByRole("listitem")
      .filter({ hasText: "Downloads" })
      .click();

    // Verify download link exists and has correct href pattern
    const downloadLink = mediaPage.getDownloadLink("download.mp4");
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toHaveAttribute(
      "href",
      /\/api\/sftp\/download\/file\//
    );
  });

  test("shows empty state when no files attached", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create an empty folder
    const folderPath = `${sftpConfig.basePath}/EmptyFolder`;
    await createSftpTestDir(folderPath, sftpConfig);

    // Navigate to my-items - with single connection, filter auto-selects it
    await page.goto("/my-items");
    await expect(page.getByRole("combobox")).toContainText("Media Server");
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Navigate to empty folder
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "EmptyFolder" })
    ).toBeVisible({ timeout: 10000 });
    await treeView
      .getByRole("listitem")
      .filter({ hasText: "EmptyFolder" })
      .click();

    // Empty state shows "No items yet" for empty items view
    await expect(page.getByText(/no items yet/i)).toBeVisible();
  });

  test("displays artwork as thumbnails", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folder with multiple artwork files
    const folderPath = `${sftpConfig.basePath}/Gallery`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestImage(`${folderPath}/art1.jpg`, sftpConfig);
    await createSftpTestImage(`${folderPath}/art2.png`, sftpConfig);
    await createSftpTestFile(`${folderPath}/video.mp4`, "video", sftpConfig);

    // Navigate to my-items - with single connection, filter auto-selects it
    await page.goto("/my-items");
    await expect(page.getByRole("combobox")).toContainText("Media Server");
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Navigate to gallery folder
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "Gallery" })
    ).toBeVisible({ timeout: 10000 });
    await treeView.getByRole("listitem").filter({ hasText: "Gallery" }).click();

    // Verify artwork gallery section exists with images
    await mediaPage.expectArtworkCount(2);
  });

  test("shows tabs when item has both files and child items", async ({
    page,
    connectionsPage,
    sftpConfig,
  }) => {
    // Create folder with both files and a subfolder
    const folderPath = `${sftpConfig.basePath}/Mixed`;
    const subfolderPath = `${folderPath}/Subfolder`;
    await createSftpTestDir(folderPath, sftpConfig);
    await createSftpTestDir(subfolderPath, sftpConfig);
    await createSftpTestFile(`${folderPath}/video.mp4`, "video", sftpConfig);

    // Navigate to my-items - with single connection, filter auto-selects it
    await page.goto("/my-items");
    await expect(page.getByRole("combobox")).toContainText("Media Server");
    const syncButton = page.getByRole("button", { name: /^sync$/i });
    await expect(syncButton).toBeVisible({ timeout: 10000 });
    await syncButton.click();
    await expect(page.getByRole("button", { name: /synced/i })).toBeVisible({
      timeout: 30000,
    });

    // Navigate to Mixed item
    const treeView = page.getByTestId("items-tree-view");
    await expect(
      treeView.getByRole("listitem").filter({ hasText: "Mixed" })
    ).toBeVisible({ timeout: 10000 });
    await treeView.getByRole("listitem").filter({ hasText: "Mixed" }).click();

    // Verify tabs are visible
    await mediaPage.expectTabsVisible();

    // Click media tab and verify files
    await mediaPage.clickMediaTab();
    await mediaPage.expectMediaFile("video.mp4");

    // Click subfolders tab and verify subfolder appears in tree
    await mediaPage.clickSubfoldersTab();
    await expect(
      page.getByTestId("items-tree-view").getByText("Subfolder")
    ).toBeVisible();
  });
});
