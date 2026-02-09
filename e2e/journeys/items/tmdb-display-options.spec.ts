/**
 * E2E tests for per-item TMDB display options.
 * Tests that tmdbShow* boolean fields control which metadata sections
 * are visible in the hero and About tab.
 */

import { test, expect, prisma } from "../../fixtures";

test.describe("TMDB Display Options", () => {
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, {
      timeout: 10000,
    });
  });

  test("shows all sections when all tmdbShow options are true", async ({
    page,
    testUser,
  }) => {
    const item = await prisma.item.create({
      data: {
        name: "The Shawshank Redemption",
        userId: testUser.id,
        depth: 0,
        order: 0,
        tmdbId: 278,
        tmdbType: "movie",
        tmdbShowTagline: true,
        tmdbShowMetadata: true,
        tmdbShowGenres: true,
        tmdbShowCast: true,
        tmdbShowProviders: true,
        tmdbShowVideos: true,
        tmdbShowRecommendations: true,
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Hero should show tagline and metadata
    await expect(page.getByTestId("hero-tagline")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("hero-metadata-line")).toBeVisible();

    // Switch to About tab and verify sections
    const aboutTab = page.getByTestId("tab-about");
    await expect(aboutTab).toBeVisible({ timeout: 10000 });
    await aboutTab.click();
    await expect(page.getByTestId("about-tab-content")).toBeVisible();
    await expect(page.getByTestId("about-cast-section")).toBeVisible();
  });

  test("hides cast when tmdbShowCast is false", async ({ page, testUser }) => {
    const item = await prisma.item.create({
      data: {
        name: "Hidden Cast Item",
        userId: testUser.id,
        depth: 0,
        order: 0,
        tmdbId: 278,
        tmdbType: "movie",
        tmdbShowCast: false,
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Switch to About tab
    const aboutTab = page.getByTestId("tab-about");
    await expect(aboutTab).toBeVisible({ timeout: 10000 });
    await aboutTab.click();
    await expect(page.getByTestId("about-tab-content")).toBeVisible();

    // Cast section should NOT be visible
    await expect(page.getByTestId("about-cast-section")).not.toBeVisible();
  });

  test("hides providers when tmdbShowProviders is false", async ({
    page,
    testUser,
  }) => {
    const item = await prisma.item.create({
      data: {
        name: "Hidden Providers Item",
        userId: testUser.id,
        depth: 0,
        order: 0,
        tmdbId: 278,
        tmdbType: "movie",
        tmdbShowProviders: false,
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Switch to About tab
    const aboutTab = page.getByTestId("tab-about");
    await expect(aboutTab).toBeVisible({ timeout: 10000 });
    await aboutTab.click();
    await expect(page.getByTestId("about-tab-content")).toBeVisible();

    // Providers section should NOT be visible
    await expect(page.getByTestId("about-providers-section")).not.toBeVisible();
  });

  test("hides tagline when tmdbShowTagline is false", async ({
    page,
    testUser,
  }) => {
    const item = await prisma.item.create({
      data: {
        name: "Hidden Tagline Item",
        userId: testUser.id,
        depth: 0,
        order: 0,
        tmdbId: 278,
        tmdbType: "movie",
        tmdbShowTagline: false,
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Tagline should NOT be visible in hero
    await expect(page.getByTestId("hero-tagline")).not.toBeVisible();
  });

  test("hides metadata when tmdbShowMetadata is false", async ({
    page,
    testUser,
  }) => {
    const item = await prisma.item.create({
      data: {
        name: "Hidden Metadata Item",
        userId: testUser.id,
        depth: 0,
        order: 0,
        tmdbId: 278,
        tmdbType: "movie",
        tmdbShowMetadata: false,
        tmdbShowGenres: false,
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Metadata line should NOT be visible in hero
    await expect(page.getByTestId("hero-metadata-line")).not.toBeVisible();
  });

  test("display options persist through reload", async ({ page, testUser }) => {
    const item = await prisma.item.create({
      data: {
        name: "Persistent Options Item",
        userId: testUser.id,
        depth: 0,
        order: 0,
        tmdbId: 278,
        tmdbType: "movie",
        tmdbShowTagline: false,
        tmdbShowCast: false,
      },
    });

    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Tagline hidden on initial load
    await expect(page.getByTestId("hero-tagline")).not.toBeVisible();

    // Reload and verify options persist
    await page.reload();
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Still hidden after reload
    await expect(page.getByTestId("hero-tagline")).not.toBeVisible();
  });

  test("display options respected on public item detail", async ({
    page,
    testUser,
  }) => {
    // Make user public so the item is viewable publicly
    await prisma.user.update({
      where: { id: testUser.id },
      data: { isPublic: true },
    });

    const item = await prisma.item.create({
      data: {
        name: "Public Display Options",
        userId: testUser.id,
        depth: 0,
        order: 0,
        isPublic: true,
        inheritVisibility: false,
        tmdbId: 278,
        tmdbType: "movie",
        tmdbShowTagline: false,
        tmdbShowMetadata: false,
        tmdbShowGenres: false,
      },
    });

    // Navigate to public item URL
    await page.goto(`/u/${testUser.username}/${item.id}`);
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Display options should be respected
    await expect(page.getByTestId("hero-tagline")).not.toBeVisible();
    await expect(page.getByTestId("hero-metadata-line")).not.toBeVisible();
  });
});
