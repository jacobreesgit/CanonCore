/**
 * E2E tests for playback progress tracking and "Go to" navigation.
 * Tests progress bar display, progress label formatting, and continue watching flow.
 */

import { test, expect, prisma } from "../../fixtures";

test.describe("Playback Progress Journey", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("displays progress bar for parent with watched children", async ({
    page,
    itemsPage,
    testUser,
  }) => {
    // Create parent item with children that have media files with progress
    const parent = await prisma.item.create({
      data: {
        name: "TV Show",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    // Create 3 episode items - 2 watched (90%+), 1 unwatched
    const episode1 = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId: testUser.id,
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
        userId: testUser.id,
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
        userId: testUser.id,
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
    testUser,
  }) => {
    // Create parent with one complete and one incomplete episode
    const parent = await prisma.item.create({
      data: {
        name: "Series",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    // Episode 1: complete (95% watched)
    const ep1 = await prisma.item.create({
      data: {
        name: "S01E01",
        userId: testUser.id,
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
        userId: testUser.id,
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
    const gotoButton = page.getByTestId("hero-goto-button");
    await expect(gotoButton).toBeVisible();
    await expect(gotoButton).toContainText("Next Up: S01E02");
  });

  test("Go to button navigates to first incomplete item", async ({
    page,
    itemsPage,
    testUser,
  }) => {
    // Create a series with episodes
    const parent = await prisma.item.create({
      data: {
        name: "My Series",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    // Episode 1: complete
    const ep1 = await prisma.item.create({
      data: {
        name: "First Episode",
        userId: testUser.id,
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
        userId: testUser.id,
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
    const gotoButton = page.getByTestId("hero-goto-button");
    await gotoButton.click();

    // Should navigate to the incomplete episode
    await expect(page).toHaveURL(new RegExp(`/u/[a-zA-Z0-9_]+/${ep2.id}`));
    await itemsPage.expectHeroVisible("Second Episode");
  });

  test("no Go to button when all items are complete", async ({
    page,
    itemsPage,
    testUser,
  }) => {
    // Create parent with all complete episodes
    const parent = await prisma.item.create({
      data: {
        name: "Finished Series",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    const ep1 = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId: testUser.id,
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
        userId: testUser.id,
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
    await expect(page.getByTestId("hero-goto-button")).not.toBeVisible();

    // Progress should show 100% (2/2 watched)
    await expect(page.getByTestId("hero-progress-label")).toContainText(
      "2/2 watched"
    );
  });

  test("no progress bar for items without media children", async ({
    page,
    itemsPage,
    testUser,
  }) => {
    // Create parent with children but no media files
    const parent = await prisma.item.create({
      data: {
        name: "Empty Folder",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    await prisma.item.create({
      data: {
        name: "Child 1",
        userId: testUser.id,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    await prisma.item.create({
      data: {
        name: "Child 2",
        userId: testUser.id,
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
    await expect(page.getByTestId("hero-goto-button")).not.toBeVisible();
  });

  test("progress updates correctly after navigating back", async ({
    page,
    itemsPage,
    testUser,
  }) => {
    // Create series with one incomplete episode
    const parent = await prisma.item.create({
      data: {
        name: "Test Series",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    const ep1 = await prisma.item.create({
      data: {
        name: "Test Episode",
        userId: testUser.id,
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
    // Use itemsPage.goto instead of breadcrumb click for mobile reliability
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();
    await itemsPage.gotoItemAndWaitForContent(parent.id);

    // Progress should update (1/1 watched)
    await expect(page.getByTestId("hero-progress-label")).toContainText(
      "1/1 watched"
    );
  });
});
