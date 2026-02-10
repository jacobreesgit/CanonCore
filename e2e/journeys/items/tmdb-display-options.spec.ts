/**
 * E2E tests for per-item TMDB display options.
 * Tests that tmdbShow* boolean fields control which metadata sections
 * are visible in the hero and About tab.
 */

import { test, expect, prisma } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";

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

  test.describe("Settings dialog TMDB tab", () => {
    test("shows TMDB tab for items with TMDB metadata", async ({
      page,
      testUser,
    }) => {
      const item = await prisma.item.create({
        data: {
          name: "TMDB Settings Tab Item",
          userId: testUser.id,
          depth: 0,
          order: 0,
          tmdbId: 278,
          tmdbType: "movie",
        },
      });

      const itemsPage = new ItemsPage(page, testUser.username);
      await page.goto(`/u/${testUser.username}/${item.id}`);
      await expect(page.getByTestId("hero-carousel")).toBeVisible({
        timeout: 10000,
      });

      // Open settings (viewport-aware: Settings button on desktop, Options trigger on mobile)
      await itemsPage.openSettingsFromToolbar();
      const container = await itemsPage.getSettingsContainer();
      await expect(container).toBeVisible();

      // Verify TMDB tab is visible
      await expect(container.getByRole("tab", { name: /tmdb/i })).toBeVisible();
    });

    test("does not show TMDB tab for items without TMDB metadata", async ({
      page,
      testUser,
    }) => {
      const item = await prisma.item.create({
        data: {
          name: "No TMDB Item",
          userId: testUser.id,
          depth: 0,
          order: 0,
        },
      });

      const itemsPage = new ItemsPage(page, testUser.username);
      await page.goto(`/u/${testUser.username}/${item.id}`);
      await expect(page.getByTestId("hero-carousel")).toBeVisible({
        timeout: 10000,
      });

      await itemsPage.openSettingsFromToolbar();
      const container = await itemsPage.getSettingsContainer();
      await expect(container).toBeVisible();

      // TMDB tab should NOT be present
      await expect(
        container.getByRole("tab", { name: /tmdb/i })
      ).not.toBeVisible();
    });

    test("can toggle display options and changes persist", async ({
      page,
      testUser,
    }) => {
      const item = await prisma.item.create({
        data: {
          name: "Toggle Options Item",
          userId: testUser.id,
          depth: 0,
          order: 0,
          tmdbId: 278,
          tmdbType: "movie",
          tmdbShowCast: true,
        },
      });

      const itemsPage = new ItemsPage(page, testUser.username);
      await page.goto(`/u/${testUser.username}/${item.id}`);
      await expect(page.getByTestId("hero-carousel")).toBeVisible({
        timeout: 10000,
      });

      // Open settings and navigate to TMDB tab
      await itemsPage.openSettingsFromToolbar();
      const container = await itemsPage.getSettingsContainer();
      await container.getByRole("tab", { name: /tmdb/i }).click();

      // Uncheck "Cast" — find checkbox associated with the Cast label
      const castCheckboxInTab = container.getByRole("checkbox", {
        name: /cast/i,
      });
      // Set up response listener before clicking (debounced save fires after 300ms)
      const savePromise = page.waitForResponse(
        (resp) => resp.request().method() === "POST" && resp.status() === 200,
        { timeout: 5000 }
      );
      await castCheckboxInTab.click();
      await savePromise;

      // Close settings
      await itemsPage.closeSettings();

      // Reload and reopen settings — verify Cast is still unchecked
      await page.reload();
      await expect(page.getByTestId("hero-carousel")).toBeVisible({
        timeout: 10000,
      });
      await itemsPage.openSettingsFromToolbar();
      const reopened = await itemsPage.getSettingsContainer();
      await reopened.getByRole("tab", { name: /tmdb/i }).click();

      const castCheckboxVerify = reopened.getByRole("checkbox", {
        name: /cast/i,
      });
      await expect(castCheckboxVerify).not.toBeChecked();
    });
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
