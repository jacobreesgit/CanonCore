/**
 * E2E tests for public profile viewer enhancements.
 * Tests viewer sort/filter, pinned section visibility,
 * and profile hero progress display.
 */

import { test, expect, prisma } from "../../fixtures";
import {
  generateUniqueEmail,
  generateUniqueUsername,
  TEST_PASSWORD,
} from "../../helpers/test-user";

test.describe("Profile Viewer Features", () => {
  test.describe.configure({ mode: "serial" });

  let ownerEmail: string;
  let ownerId: string;
  let ownerUsername: string;

  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, {
      timeout: 10000,
    });

    // Create a public profile owner with multiple items
    ownerEmail = generateUniqueEmail("pvf-owner");
    ownerUsername = generateUniqueUsername("pv");

    const { hash } = await import("bcryptjs");
    const passwordHash = await hash(TEST_PASSWORD, 10);

    const owner = await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash,
        isPublic: true,
        username: ownerUsername,
      },
    });
    ownerId = owner.id;
  });

  test.afterEach(async () => {
    await prisma.itemFile
      .deleteMany({ where: { item: { userId: ownerId } } })
      .catch(() => {});
    await prisma.item
      .deleteMany({ where: { userId: ownerId } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
  });

  test("viewer can sort items on public profile", async ({
    page,
    publicProfilePage,
  }) => {
    // Create items with different names
    await prisma.item.createMany({
      data: [
        {
          name: "Alpha Collection",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
        {
          name: "Zeta Collection",
          userId: ownerId,
          depth: 0,
          order: 1,
          isPublic: true,
          inheritVisibility: false,
        },
      ],
    });

    await publicProfilePage.gotoProfile(ownerUsername);
    await expect(page.getByTestId("items-grid-view")).toBeVisible({
      timeout: 10000,
    });

    // Both items visible
    await expect(page.getByText("Alpha Collection").first()).toBeVisible();
    await expect(page.getByText("Zeta Collection").first()).toBeVisible();

    // Change sort to Name A-Z
    await publicProfilePage.selectSortOption("Name A-Z");

    // Items should still be visible (sorted differently)
    await expect(page.getByText("Alpha Collection").first()).toBeVisible();
    await expect(page.getByText("Zeta Collection").first()).toBeVisible();
  });

  test("viewer sees pinned section on public profile", async ({
    page,
    publicProfilePage,
  }) => {
    // Create a pinned item and an unpinned item
    await prisma.item.createMany({
      data: [
        {
          name: "Pinned Favorite",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
          pinnedOrder: 0,
        },
        {
          name: "Regular Item",
          userId: ownerId,
          depth: 0,
          order: 1,
          isPublic: true,
          inheritVisibility: false,
        },
      ],
    });

    await publicProfilePage.gotoProfile(ownerUsername);
    await expect(page.getByTestId("items-grid-view")).toBeVisible({
      timeout: 10000,
    });

    // Pinned section should be visible
    await publicProfilePage.expectPinnedSectionVisible();

    // Pinned item should appear in pinned grid
    const pinnedGrid = page.getByTestId("pinned-items-grid");
    await expect(pinnedGrid.getByText("Pinned Favorite").first()).toBeVisible();

    // Library section heading should appear when pinned section exists
    await expect(page.getByText("Library")).toBeVisible();
  });

  test("viewer can filter items on public profile", async ({
    page,
    publicProfilePage,
  }) => {
    // Create one item with a media file and one without
    const itemWithFile = await prisma.item.create({
      data: {
        name: "Item With Media",
        userId: ownerId,
        depth: 0,
        order: 0,
        isPublic: true,
        inheritVisibility: false,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: itemWithFile.id,
        filename: "video.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        isHero: false,
      },
    });

    await prisma.item.create({
      data: {
        name: "Item Without Files",
        userId: ownerId,
        depth: 0,
        order: 1,
        isPublic: true,
        inheritVisibility: false,
      },
    });

    await publicProfilePage.gotoProfile(ownerUsername);
    await expect(page.getByTestId("items-grid-view")).toBeVisible({
      timeout: 10000,
    });

    // Both items visible initially
    await expect(page.getByText("Item With Media").first()).toBeVisible();
    await expect(page.getByText("Item Without Files").first()).toBeVisible();

    // Filter to "Has Files"
    await publicProfilePage.selectFilterOption("Has Files");

    // Only item with files should be visible
    await expect(page.getByText("Item With Media").first()).toBeVisible();
    await expect(
      page.getByText("Item Without Files").first()
    ).not.toBeVisible();

    // Reset filter to "All Items"
    await publicProfilePage.selectFilterOption("All Items");
    await expect(page.getByText("Item Without Files").first()).toBeVisible();
  });

  test("profile hero shows progress bar", async ({
    page,
    publicProfilePage,
  }) => {
    // Create items with media files and progress to generate profile progress
    const item = await prisma.item.create({
      data: {
        name: "Movie With Progress",
        userId: ownerId,
        depth: 0,
        order: 0,
        isPublic: true,
        inheritVisibility: false,
      },
    });

    // Create a media file with playback position and duration to generate progress
    // Progress requires both playbackPosition and playbackDuration (>= 90% threshold)
    await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "movie.mp4",
        fileType: "MEDIA",
        mimeType: "video/mp4",
        isPrimary: true,
        isHero: false,
        playbackPosition: 5400, // 90 minutes watched
        playbackDuration: 6000, // 100 minutes total (90% = watched)
      },
    });

    await publicProfilePage.gotoProfile(ownerUsername);
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Profile hero should show progress bar
    await publicProfilePage.expectHeroProgressVisible();
  });
});
