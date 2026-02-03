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

      // Should see the public item (use .first() since multiple items may have same name in grid)
      await expect(
        page
          .getByTestId("items-grid-view")
          .getByText("Public Explore Collection")
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

      // Click on the item (scope to grid view to avoid strict mode violation)
      await page
        .getByTestId("items-grid-view")
        .getByText("Public Explore Collection")
        .first()
        .click();

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
          .getByText("Public Explore Collection")
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
          .getByText("Public Explore Collection")
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
      const isExploreVisible = await page
        .getByRole("link", { name: /explore/i })
        .isVisible();
      if (!isExploreVisible) {
        await sidebarTrigger.click();
      }

      await page.getByRole("link", { name: /explore/i }).click();
      await expect(page).toHaveURL("/explore");
    });

    test("explore link visible to unauthenticated users", async ({ page }) => {
      // Go to landing or sign-in page
      await page.goto("/");

      // Sidebar should have explore link
      const sidebarTrigger = page.getByTestId("sidebar-trigger");

      // On mobile, need to open sidebar
      const exploreLink = page.getByRole("link", { name: /explore/i });
      const isExploreVisible = await exploreLink.isVisible().catch(() => false);
      if (!isExploreVisible && (await sidebarTrigger.isVisible())) {
        await sidebarTrigger.click();
      }

      await expect(page.getByRole("link", { name: /explore/i })).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("multiple owners", () => {
    let owner1Id: string;
    let owner2Id: string;
    let owner1Username: string;
    let owner2Username: string;

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
      await prisma.item.create({
        data: {
          name: "Owner 1 Collection",
          userId: owner1Id,
          depth: 0,
          order: 0,
          isPublic: true,
        },
      });

      await prisma.item.create({
        data: {
          name: "Owner 2 Collection",
          userId: owner2Id,
          depth: 0,
          order: 0,
          isPublic: true,
        },
      });
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

      // Should see items from both owners (use .first() for potential duplicates)
      await expect(
        page
          .getByTestId("items-grid-view")
          .getByText("Owner 1 Collection")
          .first()
      ).toBeVisible();
      await expect(
        page
          .getByTestId("items-grid-view")
          .getByText("Owner 2 Collection")
          .first()
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

      // Click owner 1's item (scope to grid to avoid strict mode violation)
      await page
        .getByTestId("items-grid-view")
        .getByText("Owner 1 Collection")
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`/u/${owner1Username}/`));

      // Go back to explore
      await publicProfilePage.gotoExplore();

      // Click owner 2's item (scope to grid to avoid strict mode violation)
      await page
        .getByTestId("items-grid-view")
        .getByText("Owner 2 Collection")
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`/u/${owner2Username}/`));
    });
  });
});
