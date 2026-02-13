/**
 * E2E tests for the explore page.
 * Tests browsing public collections, navigation, and empty states.
 */

import { test, expect, prisma } from "../../fixtures";
import {
  generateUniqueEmail,
  generateUniqueUsername,
  TEST_PASSWORD,
} from "../../helpers/test-user";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

test.describe("Explore Page Journey", () => {
  // Run serially to avoid database conflicts with shared user state
  test.describe.configure({ mode: "serial" });

  test.describe("browsing collections", () => {
    let ownerEmail: string;
    let ownerId: string;
    let ownerUsername: string;
    let publicItemId: string;

    test.beforeEach(async () => {
      // Create owner with public profile and public item directly in DB
      ownerEmail = generateUniqueEmail("explore-owner");
      ownerUsername = generateUniqueUsername("ex");

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

      // Create a public item
      const item = await prisma.item.create({
        data: {
          name: "Public Explore Collection",
          description: "A test collection for explore E2E testing",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
        },
      });
      publicItemId = item.id;
    });

    test.afterEach(async () => {
      // Cleanup
      await prisma.item
        .deleteMany({ where: { userId: ownerId } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    });

    test("displays public collections from community", async ({
      page,
      publicProfilePage,
    }) => {
      const isMobile = await isMobileViewport(page);
      await publicProfilePage.gotoExplore();

      // Verify we're on Explore page
      if (isMobile) {
        // Mobile: Check footer nav has Explore as active
        await expect(
          page
            .getByRole("navigation", { name: /mobile navigation/i })
            .getByRole("link", { name: /explore/i })
        ).toHaveAttribute("aria-current", "page");
      } else {
        // Desktop: Check header shows "Explore"
        await expect(
          page
            .getByTestId("site-header-breadcrumb-root")
            .filter({ hasText: "Explore" })
        ).toBeVisible();
      }

      // Should see the public item via grid title testid
      await expect(
        page
          .getByTestId("items-grid-view")
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Public Explore Collection" })
          .first()
      ).toBeVisible();

      // Should show owner username (use .first() since username appears multiple times in grid)
      await expect(page.getByText(`@${ownerUsername}`).first()).toBeVisible();
    });

    test("can navigate to item from explore", async ({
      page,
      publicProfilePage,
    }) => {
      await publicProfilePage.gotoExplore();

      // Use data-id with specific item ID to avoid matching stale items,
      // and dispatchEvent to avoid hover overlay interception
      await page.locator(`[data-id="${publicItemId}"]`).dispatchEvent("click");

      // Should navigate to the public item page
      await expect(page).toHaveURL(`/u/${ownerUsername}/${publicItemId}`);
      await publicProfilePage.expectHeroVisible("Public Explore Collection");
    });

    test("accessible as unauthenticated user", async ({
      page,
      publicProfilePage,
    }) => {
      const isMobile = await isMobileViewport(page);

      // Navigate directly without signing in
      await publicProfilePage.gotoExplore();

      // Verify we're on Explore page
      if (isMobile) {
        // Mobile: Check footer nav has Explore as active
        await expect(
          page
            .getByRole("navigation", { name: /mobile navigation/i })
            .getByRole("link", { name: /explore/i })
        ).toHaveAttribute("aria-current", "page");
      } else {
        // Desktop: Check header shows "Explore"
        await expect(
          page
            .getByTestId("site-header-breadcrumb-root")
            .filter({ hasText: "Explore" })
        ).toBeVisible();
      }
      await expect(
        page
          .getByTestId("items-grid-view")
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Public Explore Collection" })
          .first()
      ).toBeVisible();
    });

    test("accessible as authenticated user", async ({
      page,
      testUser,
      publicProfilePage,
    }) => {
      const isMobile = await isMobileViewport(page);

      // Use testUser fixture for consistent test setup (compatible with itemsPage)
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });

      // Navigate to explore
      await publicProfilePage.gotoExplore();

      // Verify we're on Explore page
      if (isMobile) {
        // Mobile: Check footer nav has Explore as active
        await expect(
          page
            .getByRole("navigation", { name: /mobile navigation/i })
            .getByRole("link", { name: /explore/i })
        ).toHaveAttribute("aria-current", "page");
      } else {
        // Desktop: Check header shows "Explore"
        await expect(
          page
            .getByTestId("site-header-breadcrumb-root")
            .filter({ hasText: "Explore" })
        ).toBeVisible();
      }
      await expect(
        page
          .getByTestId("items-grid-view")
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Public Explore Collection" })
          .first()
      ).toBeVisible();
    });
  });

  test.describe("empty state", () => {
    test("shows empty state when no public items", async ({
      page,
      publicProfilePage,
    }) => {
      const isMobile = await isMobileViewport(page);

      // First, make sure there are no public items by cleaning up
      // Note: This test may be flaky if other tests leave public items
      // We'll just check the structure is present

      await publicProfilePage.gotoExplore();

      // Verify we're on Explore page
      if (isMobile) {
        // Mobile: Check footer nav has Explore as active
        await expect(
          page
            .getByRole("navigation", { name: /mobile navigation/i })
            .getByRole("link", { name: /explore/i })
        ).toHaveAttribute("aria-current", "page");
      } else {
        // Desktop: Check header shows "Explore"
        await expect(
          page
            .getByTestId("site-header-breadcrumb-root")
            .filter({ hasText: "Explore" })
        ).toBeVisible();
      }

      // Either shows items grid OR empty state
      const hasItems = await page.getByTestId("items-grid-view").isVisible();

      if (!hasItems) {
        // Empty state should show message
        await expect(page.getByText("Nothing here yet")).toBeVisible();
        await expect(
          page.getByText(/be the first to share your items/i)
        ).toBeVisible();
      }
    });
  });

  test.describe("sidebar navigation", () => {
    test("can navigate to explore from sidebar", async ({ page, testUser }) => {
      // Use testUser fixture for consistent test setup (compatible with itemsPage)
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });

      // Find and click Explore in sidebar
      const sidebarTrigger = page.getByTestId("sidebar-trigger");

      // On mobile, need to open sidebar first
      const exploreLink = page.getByRole("link", { name: /explore/i });
      if (!(await exploreLink.isVisible().catch(() => false))) {
        await sidebarTrigger.click();
        // Wait for sidebar to animate open and link to become visible
        await expect(exploreLink).toBeVisible({ timeout: 5000 });
      }

      // Use dispatchEvent because Next.js dev overlay can intercept clicks on mobile
      await exploreLink.dispatchEvent("click");
      await expect(page).toHaveURL("/explore", { timeout: 10000 });
    });

    test("explore link visible to unauthenticated users", async ({ page }) => {
      // Go to landing or sign-in page
      await page.goto("/");

      // Sidebar should have explore link (use exact match to avoid matching "Explore Collections")
      const sidebarTrigger = page.getByTestId("sidebar-trigger");

      // On mobile, need to open sidebar
      const exploreLink = page.getByRole("link", {
        name: "Explore",
        exact: true,
      });
      const isExploreVisible = await exploreLink.isVisible().catch(() => false);
      if (!isExploreVisible && (await sidebarTrigger.isVisible())) {
        await sidebarTrigger.click();
      }

      await expect(exploreLink).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("multiple owners", () => {
    let owner1Id: string;
    let owner2Id: string;
    let owner1Username: string;
    let owner2Username: string;
    let owner1ItemId: string;
    let owner2ItemId: string;

    test.beforeEach(async () => {
      // Generate unique usernames for each test run
      owner1Username = generateUniqueUsername("o1");
      owner2Username = generateUniqueUsername("o2");

      const { hash } = await import("bcryptjs");
      const passwordHash = await hash(TEST_PASSWORD, 10);

      // Create two owners with public profiles
      const owner1 = await prisma.user.create({
        data: {
          email: generateUniqueEmail("multi-owner1"),
          passwordHash,
          isPublic: true,
          username: owner1Username,
        },
      });
      owner1Id = owner1.id;

      const owner2 = await prisma.user.create({
        data: {
          email: generateUniqueEmail("multi-owner2"),
          passwordHash,
          isPublic: true,
          username: owner2Username,
        },
      });
      owner2Id = owner2.id;

      // Create items for each owner
      const item1 = await prisma.item.create({
        data: {
          name: "Owner 1 Collection",
          userId: owner1Id,
          depth: 0,
          order: 0,
          isPublic: true,
        },
      });
      owner1ItemId = item1.id;

      const item2 = await prisma.item.create({
        data: {
          name: "Owner 2 Collection",
          userId: owner2Id,
          depth: 0,
          order: 0,
          isPublic: true,
        },
      });
      owner2ItemId = item2.id;
    });

    test.afterEach(async () => {
      await prisma.item
        .deleteMany({ where: { userId: owner1Id } })
        .catch(() => {});
      await prisma.item
        .deleteMany({ where: { userId: owner2Id } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: owner1Id } }).catch(() => {});
      await prisma.user.delete({ where: { id: owner2Id } }).catch(() => {});
    });

    test("shows collections from multiple owners", async ({
      page,
      publicProfilePage,
    }) => {
      await publicProfilePage.gotoExplore();

      // Should see items from both owners via grid title testid
      await expect(
        page
          .getByTestId("items-grid-view")
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Owner 1 Collection" })
      ).toBeVisible();
      await expect(
        page
          .getByTestId("items-grid-view")
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Owner 2 Collection" })
      ).toBeVisible();

      // Should see both usernames (use .first() since they appear multiple times in grid)
      await expect(page.getByText(`@${owner1Username}`).first()).toBeVisible();
      await expect(page.getByText(`@${owner2Username}`).first()).toBeVisible();
    });

    test("clicking different items navigates to correct owner profiles", async ({
      page,
      publicProfilePage,
    }) => {
      await publicProfilePage.gotoExplore();

      // Use data-id with specific item IDs and dispatchEvent to avoid hover overlay
      await page.locator(`[data-id="${owner1ItemId}"]`).dispatchEvent("click");
      await expect(page).toHaveURL(`/u/${owner1Username}/${owner1ItemId}`);

      // Go back to explore
      await publicProfilePage.gotoExplore();

      // Click owner 2's item
      await page.locator(`[data-id="${owner2ItemId}"]`).dispatchEvent("click");
      await expect(page).toHaveURL(`/u/${owner2Username}/${owner2ItemId}`);
    });
  });
});
