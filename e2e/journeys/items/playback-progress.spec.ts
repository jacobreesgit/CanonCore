/**
 * E2E tests for playback progress tracking and "Go to" navigation.
 * Tests progress bar display, progress label formatting, and continue watching flow.
 */

import { test, expect, prisma } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Playback Progress Journey", () => {
  let userEmail: string;
  let userId: string;

  test.beforeEach(async ({ page, signUpPage }) => {
    // Create a new user for each test
    userEmail = generateUniqueEmail("progress");

    await signUpPage.goto();
    await signUpPage.signUp(userEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Get user ID for seeding and cleanup
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });
    userId = user!.id;
  });

  test.afterEach(async () => {
    // Cleanup - delete items first (includes ItemFiles via cascade)
    await prisma.itemFile
      .deleteMany({ where: { item: { userId } } })
      .catch(() => {});
    await prisma.item.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  test("displays progress bar for parent with watched children", async ({
    page,
    itemsPage,
  }) => {
    // Create parent item with children that have media files with progress
    const parent = await prisma.item.create({
      data: {
        name: "TV Show",
        userId,
        order: 0,
        depth: 0,
      },
    });

    // Create 3 episode items - 2 watched (90%+), 1 unwatched
    const episode1 = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: episode1.id,
        filename: "episode1.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 2700, // 45 min = 90% of 50 min
        playbackDuration: 3000, // 50 min
      },
    });

    const episode2 = await prisma.item.create({
      data: {
        name: "Episode 2",
        userId,
        parentId: parent.id,
        order: 1,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: episode2.id,
        filename: "episode2.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 2800, // 46+ min = 93%
        playbackDuration: 3000,
      },
    });

    const episode3 = await prisma.item.create({
      data: {
        name: "Episode 3",
        userId,
        parentId: parent.id,
        order: 2,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: episode3.id,
        filename: "episode3.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 300, // 5 min = only 10%
        playbackDuration: 3000,
      },
    });

    // Navigate directly to parent item by ID
    await itemsPage.gotoItemAndWaitForContent(parent.id);
    await itemsPage.expectHeroVisible("TV Show");

    // Verify progress bar is visible (67% = 2/3 watched)
    await expect(page.getByTestId("hero-progress-bar")).toBeVisible();
    await expect(page.getByTestId("hero-progress-label")).toContainText(
      "2/3 watched"
    );
  });

  test("shows Go to button for next incomplete item", async ({
    page,
    itemsPage,
  }) => {
    // Create parent with one complete and one incomplete episode
    const parent = await prisma.item.create({
      data: {
        name: "Series",
        userId,
        order: 0,
        depth: 0,
      },
    });

    // Episode 1: complete (95% watched)
    const ep1 = await prisma.item.create({
      data: {
        name: "S01E01",
        userId,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: ep1.id,
        filename: "s01e01.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 2850, // 95%
        playbackDuration: 3000,
      },
    });

    // Episode 2: incomplete (30% watched)
    const ep2 = await prisma.item.create({
      data: {
        name: "S01E02",
        userId,
        parentId: parent.id,
        order: 1,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: ep2.id,
        filename: "s01e02.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 900, // 30%
        playbackDuration: 3000,
      },
    });

    // Navigate directly to parent item by ID
    await itemsPage.gotoItemAndWaitForContent(parent.id);
    await itemsPage.expectHeroVisible("Series");

    // Go to button should be visible with next incomplete item name
    const gotoButton = page.getByTestId("item-hero-goto");
    await expect(gotoButton).toBeVisible();
    await expect(gotoButton).toContainText("Go to S01E02");
  });

  test("Go to button navigates to first incomplete item", async ({
    page,
    itemsPage,
  }) => {
    // Create a series with episodes
    const parent = await prisma.item.create({
      data: {
        name: "My Series",
        userId,
        order: 0,
        depth: 0,
      },
    });

    // Episode 1: complete
    const ep1 = await prisma.item.create({
      data: {
        name: "First Episode",
        userId,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: ep1.id,
        filename: "ep1.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 2900, // 96.7%
        playbackDuration: 3000,
      },
    });

    // Episode 2: incomplete - this should be the "Go to" target
    const ep2 = await prisma.item.create({
      data: {
        name: "Second Episode",
        userId,
        parentId: parent.id,
        order: 1,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: ep2.id,
        filename: "ep2.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 600, // 20%
        playbackDuration: 3000,
      },
    });

    // Navigate directly to parent item by ID
    await itemsPage.gotoItemAndWaitForContent(parent.id);
    await itemsPage.expectHeroVisible("My Series");

    // Click Go to button
    const gotoButton = page.getByTestId("item-hero-goto");
    await gotoButton.click();

    // Should navigate to the incomplete episode
    await expect(page).toHaveURL(new RegExp(`/my-items/${ep2.id}`));
    await itemsPage.expectHeroVisible("Second Episode");
  });

  test("no Go to button when all items are complete", async ({
    page,
    itemsPage,
  }) => {
    // Create parent with all complete episodes
    const parent = await prisma.item.create({
      data: {
        name: "Finished Series",
        userId,
        order: 0,
        depth: 0,
      },
    });

    const ep1 = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: ep1.id,
        filename: "ep1.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 2900, // 96.7%
        playbackDuration: 3000,
      },
    });

    const ep2 = await prisma.item.create({
      data: {
        name: "Episode 2",
        userId,
        parentId: parent.id,
        order: 1,
        depth: 1,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: ep2.id,
        filename: "ep2.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 2850, // 95%
        playbackDuration: 3000,
      },
    });

    // Navigate directly to parent item by ID
    await itemsPage.gotoItemAndWaitForContent(parent.id);
    await itemsPage.expectHeroVisible("Finished Series");

    // Go to button should not be visible (all complete)
    await expect(page.getByTestId("item-hero-goto")).not.toBeVisible();

    // Progress should show 100% (2/2 watched)
    await expect(page.getByTestId("hero-progress-label")).toContainText(
      "2/2 watched"
    );
  });

  test("no progress bar for items without media children", async ({
    page,
    itemsPage,
  }) => {
    // Create parent with children but no media files
    const parent = await prisma.item.create({
      data: {
        name: "Empty Folder",
        userId,
        order: 0,
        depth: 0,
      },
    });

    await prisma.item.create({
      data: {
        name: "Child 1",
        userId,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    await prisma.item.create({
      data: {
        name: "Child 2",
        userId,
        parentId: parent.id,
        order: 1,
        depth: 1,
      },
    });

    // Navigate directly to parent item by ID
    await itemsPage.gotoItemAndWaitForContent(parent.id);
    await itemsPage.expectHeroVisible("Empty Folder");

    // Progress bar should not be visible (no media files)
    await expect(page.getByTestId("hero-progress-bar")).not.toBeVisible();
    await expect(page.getByTestId("hero-progress-label")).not.toBeVisible();
    await expect(page.getByTestId("item-hero-goto")).not.toBeVisible();
  });

  test("progress updates correctly after navigating back", async ({
    page,
    itemsPage,
  }) => {
    // Create series with one incomplete episode
    const parent = await prisma.item.create({
      data: {
        name: "Test Series",
        userId,
        order: 0,
        depth: 0,
      },
    });

    const ep1 = await prisma.item.create({
      data: {
        name: "Test Episode",
        userId,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    const file = await prisma.itemFile.create({
      data: {
        itemId: ep1.id,
        filename: "test.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        playbackPosition: 300, // 10%
        playbackDuration: 3000,
      },
    });

    // Navigate directly to parent item by ID
    await itemsPage.gotoItemAndWaitForContent(parent.id);
    await itemsPage.expectHeroVisible("Test Series");

    // Verify initial progress (0/1 watched)
    await expect(page.getByTestId("hero-progress-label")).toContainText(
      "0/1 watched"
    );

    // Simulate watching the episode (update DB directly)
    await prisma.itemFile.update({
      where: { id: file.id },
      data: { playbackPosition: 2900 }, // 96.7% - now complete
    });

    // Navigate back to root and return to item
    // Use page.goto instead of breadcrumb click for mobile reliability
    await page.goto("/my-items");
    await itemsPage.waitForLoadingComplete();
    await itemsPage.gotoItemAndWaitForContent(parent.id);

    // Progress should update (1/1 watched)
    await expect(page.getByTestId("hero-progress-label")).toContainText(
      "1/1 watched"
    );
  });
});
