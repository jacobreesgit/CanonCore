import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Page transition loading states", () => {
  test("shows skeleton when navigating to Explore", async ({
    page,
    nav,
    isMobile,
  }) => {
    // Start on My Items — wait for content to fully load
    await nav.gotoMyItems();
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });

    // Navigate to Explore
    if (isMobile) {
      await nav.tapExploreMobile();
    } else {
      await nav.openSidebar();
      await page.getByRole("link", { name: "Explore" }).click();
    }

    // Skeleton should appear during navigation
    const skeleton = page.locator('[data-slot="skeleton"]').first();
    await expect(skeleton).toBeVisible({ timeout: Timeouts.navigation });

    // Content should eventually replace the skeleton
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });
  });

  test("shows skeleton when navigating to My Items", async ({
    page,
    nav,
    isMobile,
  }) => {
    // Start on Explore
    await page.goto("/explore");
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });

    // Navigate to My Items
    if (isMobile) {
      await nav.tapMyItemsMobile();
    } else {
      await nav.openSidebar();
      await page.getByRole("link", { name: "My Items" }).click();
    }

    // Skeleton visible during transition
    const skeleton = page.locator('[data-slot="skeleton"]').first();
    await expect(skeleton).toBeVisible({ timeout: Timeouts.navigation });

    // Profile content loads
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });
  });

  test("skeleton hero height matches content hero height (no CLS)", async ({
    page,
    nav,
    isMobile,
  }) => {
    test.skip(isMobile, "CLS measurement requires stable desktop viewport");

    // Start on Explore, wait for full content
    await page.goto("/explore");
    await expect(page.locator("[data-testid='hero-carousel']")).toBeVisible({
      timeout: Timeouts.heavy,
    });

    // Capture content hero height
    const contentHeroHeight = await page
      .locator("[data-testid='hero-carousel']")
      .boundingBox();

    // Navigate to My Items to trigger skeleton
    await nav.openSidebar();
    await page.getByRole("link", { name: "My Items" }).click();

    // Wait for skeleton hero to appear
    const skeletonHero = page.locator("[data-testid='skeleton-hero']");
    await expect(skeletonHero).toBeVisible({ timeout: Timeouts.navigation });

    // Capture skeleton hero height
    const skeletonHeroHeight = await skeletonHero.boundingBox();

    // Heights should be within 10% (viewport-relative heights may differ slightly
    // between explore multi-slide padding and profile single-slide padding)
    if (contentHeroHeight && skeletonHeroHeight) {
      const heightDiff = Math.abs(
        contentHeroHeight.height - skeletonHeroHeight.height
      );
      const tolerance = contentHeroHeight.height * 0.1;
      expect(heightDiff).toBeLessThan(tolerance);
    }
  });
});
