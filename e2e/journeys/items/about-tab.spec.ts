/**
 * E2E tests for the About tab on item detail pages.
 * Tests tab switching, TMDB sections (cast, providers, videos, wiki, recommendations),
 * section filter, expandable description, and public viewer access.
 */

import { test, expect, prisma } from "../../fixtures";

test.describe("About Tab", () => {
  // All tests use testUser fixture for consistent setup
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, {
      timeout: 10000,
    });
  });

  test("shows About tab when item has TMDB data and children", async ({
    page,
    testUser,
    itemsPage,
    aboutTabPage,
  }) => {
    // Create parent item with TMDB data and a child
    const parent = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        description:
          "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
        userId: testUser.id,
        order: 0,
        depth: 0,
        tmdbId: 278,
        tmdbType: "movie",
      },
    });

    await prisma.item.create({
      data: {
        name: "Behind the Scenes",
        userId: testUser.id,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    // Navigate to item detail page
    await page.goto(`/u/${testUser.username}/${parent.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The Shawshank Redemption"
    );

    // Contents tab should be active by default (has children)
    await expect(aboutTabPage.contentsTab).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Switch to About tab
    await aboutTabPage.switchToAbout();
    await expect(aboutTabPage.aboutTab).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(aboutTabPage.aboutContent).toBeVisible();

    // Switch back to Contents
    await aboutTabPage.switchToContents();
    await expect(aboutTabPage.contentsTab).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("defaults to About tab when item has TMDB data but no children", async ({
    page,
    testUser,
    aboutTabPage,
  }) => {
    // Create item with TMDB data but no children
    const item = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        description:
          "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
        userId: testUser.id,
        order: 0,
        depth: 0,
        tmdbId: 278,
        tmdbType: "movie",
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The Shawshank Redemption"
    );

    // About tab should be the default when there are no children
    await expect(aboutTabPage.aboutTab).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(aboutTabPage.aboutContent).toBeVisible();
  });

  test("shows cast section with profile images", async ({
    page,
    testUser,
    aboutTabPage,
  }) => {
    const item = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        userId: testUser.id,
        order: 0,
        depth: 0,
        tmdbId: 278,
        tmdbType: "movie",
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(aboutTabPage.aboutContent).toBeVisible({ timeout: 10000 });

    // Cast section should be visible with member names
    await expect(aboutTabPage.castSection).toBeVisible();
    await expect(
      aboutTabPage.castSection.getByRole("button").first()
    ).toBeVisible();
  });

  test("expands and collapses long description", async ({
    page,
    testUser,
    aboutTabPage,
  }) => {
    // Long description triggers the expandable behavior (>200 chars)
    const longDescription =
      "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency. " +
      "This critically acclaimed film, directed by Frank Darabont, has become one of the most beloved movies of all time, " +
      "consistently topping polls of the greatest films ever made.";

    const item = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        description: longDescription,
        userId: testUser.id,
        order: 0,
        depth: 0,
        tmdbId: 278,
        tmdbType: "movie",
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(aboutTabPage.aboutContent).toBeVisible({ timeout: 10000 });
    await expect(aboutTabPage.descriptionSection).toBeVisible();

    // Read more button should be visible
    await expect(aboutTabPage.readMoreButton).toBeVisible();
    await expect(aboutTabPage.readMoreButton).toHaveText(/Read more/);

    // Click to expand
    await aboutTabPage.readMoreButton.click();
    await expect(aboutTabPage.readMoreButton).toHaveText(/Show less/);

    // Click to collapse
    await aboutTabPage.readMoreButton.click();
    await expect(aboutTabPage.readMoreButton).toHaveText(/Read more/);
  });

  test("shows wiki section with locked items", async ({
    page,
    testUser,
    aboutTabPage,
  }) => {
    const item = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        userId: testUser.id,
        order: 0,
        depth: 0,
        tmdbId: 278,
        tmdbType: "movie",
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(aboutTabPage.aboutContent).toBeVisible({ timeout: 10000 });

    // Wiki section should be visible with "coming soon" message
    await expect(aboutTabPage.wikiSection).toBeVisible();
    await expect(
      aboutTabPage.wikiSection.getByText(/coming soon/i)
    ).toBeVisible();
  });

  // Section filter only renders on desktop (mobile MobileOptionsSheet requires both sort + filter)
  test("filters sections with section filter dropdown", async ({
    page,
    testUser,
    aboutTabPage,
    isMobile,
  }) => {
    test.skip(isMobile, "Section filter not shown on mobile");

    const item = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        description: "A classic drama film about hope and perseverance.",
        userId: testUser.id,
        order: 0,
        depth: 0,
        tmdbId: 278,
        tmdbType: "movie",
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(aboutTabPage.aboutContent).toBeVisible({ timeout: 10000 });

    // Wiki section should be visible initially (All Sections)
    await expect(aboutTabPage.wikiSection).toBeVisible();

    // Filter to show only Cast
    await aboutTabPage.selectSectionFilter("Cast");

    // Cast should be visible, wiki should be hidden
    await expect(aboutTabPage.castSection).toBeVisible();
    await expect(aboutTabPage.wikiSection).not.toBeVisible();

    // Reset to All Sections
    await aboutTabPage.selectSectionFilter("All Sections");
    await expect(aboutTabPage.wikiSection).toBeVisible();
  });

  test("supports tab keyboard navigation with arrow keys", async ({
    page,
    testUser,
    aboutTabPage,
  }) => {
    // Create item with TMDB and children (so both tabs show)
    const parent = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        userId: testUser.id,
        order: 0,
        depth: 0,
        tmdbId: 278,
        tmdbType: "movie",
      },
    });

    await prisma.item.create({
      data: {
        name: "Extras",
        userId: testUser.id,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    await page.goto(`/u/${testUser.username}/${parent.id}`);

    // Focus the Contents tab
    await aboutTabPage.contentsTab.focus();
    await expect(aboutTabPage.contentsTab).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Arrow right should move to About tab
    await page.keyboard.press("ArrowRight");
    await expect(aboutTabPage.aboutTab).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // Arrow left should move back to Contents tab
    await page.keyboard.press("ArrowLeft");
    await expect(aboutTabPage.contentsTab).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  test("shows About tab on public item detail for non-authenticated viewer", async ({
    page,
    testUser,
    aboutTabPage,
  }) => {
    // Make user profile public
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isPublic: true },
    });

    // Create explicitly public item with TMDB data
    const item = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        userId: testUser.id,
        order: 0,
        depth: 0,
        isPublic: true,
        inheritVisibility: false,
        tmdbId: 278,
        tmdbType: "movie",
      },
    });

    // Clear auth cookies to simulate non-authenticated viewer
    await page.context().clearCookies();

    // Navigate to public item page
    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "The Shawshank Redemption",
      { timeout: 10000 }
    );

    // About tab should be visible and clickable
    await expect(aboutTabPage.aboutTab).toBeVisible();
    await aboutTabPage.switchToAbout();
    await expect(aboutTabPage.aboutContent).toBeVisible();
  });

  test("handles item without TMDB data gracefully", async ({
    page,
    testUser,
  }) => {
    // Create item without TMDB data and no children
    const item = await prisma.item.create({
      data: {
        name: "My Custom Folder",
        description: "A folder without any TMDB metadata.",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "My Custom Folder"
    );

    // No tabs should be visible (no TMDB data, no children)
    await expect(page.getByTestId("tab-about")).not.toBeVisible();
    await expect(page.getByTestId("tab-contents")).not.toBeVisible();
  });

  test("respects inheritVisibility for public child items", async ({
    page,
    testUser,
    aboutTabPage,
  }) => {
    // Make user profile public
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isPublic: true },
    });

    // Create explicitly public parent with TMDB data
    const parent = await prisma.item.create({
      data: {
        name: "Breaking Bad",
        userId: testUser.id,
        order: 0,
        depth: 0,
        isPublic: true,
        inheritVisibility: false,
        tmdbId: 1396,
        tmdbType: "tv",
      },
    });

    // Create child that inherits visibility from parent
    await prisma.item.create({
      data: {
        name: "Season 1",
        userId: testUser.id,
        parentId: parent.id,
        order: 0,
        depth: 1,
        inheritVisibility: true,
      },
    });

    // Clear auth to view as public user
    await page.context().clearCookies();

    // Navigate to parent — child should be visible via inheritance
    await page.goto(`/u/${testUser.username}/${parent.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Breaking Bad",
      { timeout: 10000 }
    );

    // About tab should be available (TMDB data present)
    await expect(aboutTabPage.aboutTab).toBeVisible();

    // Contents tab should show the inherited child
    await aboutTabPage.switchToContents();
    await expect(
      page.locator("[data-id]").getByText("Season 1", { exact: true }).first()
    ).toBeVisible();
  });
});
