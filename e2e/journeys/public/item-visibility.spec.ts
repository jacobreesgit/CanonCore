/**
 * E2E tests for item visibility system.
 * Covers explicit visibility, inherited visibility, and permission cascade.
 */

import { test, expect, prisma } from "../../fixtures";
import {
  generateUniqueEmail,
  generateUniqueUsername,
  TEST_PASSWORD,
} from "../../helpers/test-user";
import { ItemsPage } from "../../pages/items.page";

// Owner with public profile for visibility tests
let ownerId: string;
let ownerEmail: string;
let ownerUsername: string;

test.describe("Item Visibility", () => {
  // Run serially to avoid issues with shared state (module-level variables, session cookies)
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const { hash } = await import("bcryptjs");
    const passwordHash = await hash(TEST_PASSWORD, 10);
    ownerEmail = generateUniqueEmail("vis-owner");
    // Add more uniqueness to username to avoid collisions in parallel runs
    const random = Math.random().toString(36).substring(2, 8);
    ownerUsername = `vis${Date.now()}${random}`;

    // Ensure no existing user with this email or username
    await prisma.user
      .deleteMany({
        where: {
          OR: [
            { email: ownerEmail },
            { username: { equals: ownerUsername, mode: "insensitive" } },
          ],
        },
      })
      .catch(() => {});

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

  test.afterAll(async () => {
    if (ownerId) {
      await prisma.item
        .deleteMany({ where: { userId: ownerId } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    }
  });

  test.describe("Explicit Visibility (isPublic)", () => {
    test.afterEach(async () => {
      await prisma.item.deleteMany({ where: { userId: ownerId } });
    });

    test("public item visible on owner's public profile", async ({
      page,
      publicProfilePage,
    }) => {
      await prisma.item.create({
        data: {
          name: "Public Collection",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });

      await publicProfilePage.gotoProfile(ownerUsername);
      // Use the page object's expectItemVisible method which targets grid items specifically
      await publicProfilePage.expectItemVisible("Public Collection");
    });

    test("private item NOT visible on owner's public profile", async ({
      page,
      publicProfilePage,
    }) => {
      await prisma.item.create({
        data: {
          name: "Private Collection",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: false,
          inheritVisibility: false,
        },
      });

      await publicProfilePage.gotoProfile(ownerUsername);
      await expect(page.getByText("Private Collection")).not.toBeVisible();
    });

    test("private item returns 404 when accessed via direct URL", async ({
      page,
      publicProfilePage,
    }) => {
      const item = await prisma.item.create({
        data: {
          name: "Private Direct Access",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: false,
          inheritVisibility: false,
        },
      });

      await publicProfilePage.gotoItem(ownerUsername, item.id);
      // Should show not found page (Next.js default 404)
      await expect(
        page.getByText(/not found|could not be found|doesn't exist/i)
      ).toBeVisible();
    });

    test("public item accessible via direct URL", async ({
      page,
      publicProfilePage,
    }) => {
      const item = await prisma.item.create({
        data: {
          name: "Public Direct Access",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });

      await publicProfilePage.gotoItem(ownerUsername, item.id);
      await publicProfilePage.expectHeroVisible("Public Direct Access");
    });
  });

  test.describe("Inherited Visibility (inheritVisibility)", () => {
    let publicParentId: string;
    let privateParentId: string;

    test.beforeEach(async () => {
      // Create public parent
      const publicParent = await prisma.item.create({
        data: {
          name: "Public Parent",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });
      publicParentId = publicParent.id;

      // Create private parent
      const privateParent = await prisma.item.create({
        data: {
          name: "Private Parent",
          userId: ownerId,
          depth: 0,
          order: 1,
          isPublic: false,
          inheritVisibility: false,
        },
      });
      privateParentId = privateParent.id;
    });

    test.afterEach(async () => {
      await prisma.item.deleteMany({ where: { userId: ownerId } });
    });

    test("inheriting child of public parent IS visible", async ({
      page,
      publicProfilePage,
    }) => {
      await prisma.item.create({
        data: {
          name: "Inheriting Child",
          userId: ownerId,
          parentId: publicParentId,
          depth: 1,
          order: 0,
          isPublic: false,
          inheritVisibility: true,
        },
      });

      // Navigate to public parent
      await publicProfilePage.gotoItem(ownerUsername, publicParentId);
      await expect(
        page
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Inheriting Child" })
      ).toBeVisible();
    });

    test("inheriting child of private parent is NOT visible", async ({
      page,
      publicProfilePage,
    }) => {
      await prisma.item.create({
        data: {
          name: "Hidden Inheriting Child",
          userId: ownerId,
          parentId: privateParentId,
          depth: 1,
          order: 0,
          isPublic: false,
          inheritVisibility: true,
        },
      });

      // Private parent not visible on profile
      await publicProfilePage.gotoProfile(ownerUsername);
      await expect(page.getByText("Private Parent")).not.toBeVisible();
      await expect(page.getByText("Hidden Inheriting Child")).not.toBeVisible();
    });

    test("explicitly public child of private parent IS accessible via direct URL", async ({
      publicProfilePage,
    }) => {
      // Create explicitly public child under private parent
      const explicitChild = await prisma.item.create({
        data: {
          name: "Explicit Public Child",
          userId: ownerId,
          parentId: privateParentId,
          depth: 1,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });

      // Explicitly public items are accessible via direct URL (not shown on profile grid - only root items there)
      await publicProfilePage.gotoItem(ownerUsername, explicitChild.id);
      await publicProfilePage.expectHeroVisible("Explicit Public Child");
    });

    test("deep inheritance chain (3 levels) works correctly", async ({
      page,
      publicProfilePage,
    }) => {
      // Public Parent > Inheriting Child > Inheriting Grandchild
      const child = await prisma.item.create({
        data: {
          name: "Middle Child",
          userId: ownerId,
          parentId: publicParentId,
          depth: 1,
          order: 0,
          isPublic: false,
          inheritVisibility: true,
        },
      });

      await prisma.item.create({
        data: {
          name: "Inheriting Grandchild",
          userId: ownerId,
          parentId: child.id,
          depth: 2,
          order: 0,
          isPublic: false,
          inheritVisibility: true,
        },
      });

      // Navigate to child, grandchild should be visible
      await publicProfilePage.gotoItem(ownerUsername, child.id);
      await expect(
        page
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Inheriting Grandchild" })
      ).toBeVisible();
    });

    test("inheritance breaks at private ancestor", async ({
      page,
      publicProfilePage,
    }) => {
      // Public Parent > Private Child > Inheriting Grandchild
      const privateChild = await prisma.item.create({
        data: {
          name: "Private Middle",
          userId: ownerId,
          parentId: publicParentId,
          depth: 1,
          order: 0,
          isPublic: false,
          inheritVisibility: false, // Explicitly private
        },
      });

      await prisma.item.create({
        data: {
          name: "Blocked Grandchild",
          userId: ownerId,
          parentId: privateChild.id,
          depth: 2,
          order: 0,
          isPublic: false,
          inheritVisibility: true, // Tries to inherit but ancestor is private
        },
      });

      // Navigate to public parent
      await publicProfilePage.gotoItem(ownerUsername, publicParentId);
      // Private child should not be visible
      await expect(page.getByText("Private Middle")).not.toBeVisible();
    });
  });

  test.describe("Explore Page Filtering", () => {
    test.afterEach(async () => {
      await prisma.item.deleteMany({ where: { userId: ownerId } });
    });

    test("explicitly public items appear on Explore", async ({
      page,
      publicProfilePage,
    }) => {
      await prisma.item.create({
        data: {
          name: "Explore Visible Item",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });

      await publicProfilePage.gotoExplore();
      await expect(
        page
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Explore Visible Item" })
          .first()
      ).toBeVisible();
    });

    test("inherited-public items do NOT appear on Explore", async ({
      page,
      publicProfilePage,
    }) => {
      // Create public parent
      const parent = await prisma.item.create({
        data: {
          name: "Parent On Explore",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });

      // Create inheriting child (effectively public but via inheritance)
      await prisma.item.create({
        data: {
          name: "Inherited Not On Explore",
          userId: ownerId,
          parentId: parent.id,
          depth: 1,
          order: 0,
          isPublic: false,
          inheritVisibility: true,
        },
      });

      await publicProfilePage.gotoExplore();
      // Parent appears (explicit public root item)
      await expect(
        page
          .locator('[data-testid="grid-item-title"]')
          .filter({ hasText: "Parent On Explore" })
          .first()
      ).toBeVisible();
      // Child does NOT appear (inherited visibility + not root)
      await expect(
        page.getByText("Inherited Not On Explore")
      ).not.toBeVisible();
    });

    test("private items do NOT appear on Explore", async ({
      page,
      publicProfilePage,
    }) => {
      await prisma.item.create({
        data: {
          name: "Private Not On Explore",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: false,
          inheritVisibility: false,
        },
      });

      await publicProfilePage.gotoExplore();
      await expect(page.getByText("Private Not On Explore")).not.toBeVisible();
    });
  });

  test.describe("Fork Visibility Behavior", () => {
    let forkerId: string;
    let forkerEmail: string;
    let forkerUsername: string;

    test.beforeAll(async () => {
      const { hash } = await import("bcryptjs");
      const passwordHash = await hash(TEST_PASSWORD, 10);
      forkerEmail = generateUniqueEmail("vis-forker");
      forkerUsername = generateUniqueUsername("fk");

      const forker = await prisma.user.create({
        data: {
          email: forkerEmail,
          passwordHash,
          username: forkerUsername,
        },
      });
      forkerId = forker.id;
    });

    test.afterAll(async () => {
      await prisma.fork
        .deleteMany({ where: { userId: forkerId } })
        .catch(() => {});
      await prisma.item
        .deleteMany({ where: { userId: forkerId } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: forkerId } }).catch(() => {});
    });

    test.afterEach(async () => {
      await prisma.fork
        .deleteMany({ where: { userId: forkerId } })
        .catch(() => {});
      await prisma.item.deleteMany({ where: { userId: ownerId } });
      await prisma.item.deleteMany({ where: { userId: forkerId } });
    });

    test("forked item has explicit visibility (inheritVisibility: false)", async ({
      page,
      signInPage,
      publicProfilePage,
    }) => {
      // Create source item
      const source = await prisma.item.create({
        data: {
          name: "Fork Source",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });

      // Clear cookies to ensure fresh sign-in (avoid redirect from previous session)
      await page.context().clearCookies();

      // Sign in as forker
      await signInPage.goto();
      await signInPage.signIn(forkerEmail, TEST_PASSWORD);
      await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });

      // Fork the item
      await publicProfilePage.gotoItem(ownerUsername, source.id);
      await publicProfilePage.forkItem();

      // Wait for fork to complete
      await expect(page.getByText(/forked/i)).toBeVisible({ timeout: 10000 });

      // Verify forked item has explicit visibility
      const forkedItem = await prisma.item.findFirst({
        where: { userId: forkerId, name: "Fork Source" },
      });

      expect(forkedItem).not.toBeNull();
      expect(forkedItem?.inheritVisibility).toBe(false);
      expect(forkedItem?.isPublic).toBe(false); // Forked items start private
    });

    test("forked item starts as private", async ({
      page,
      signInPage,
      publicProfilePage,
    }) => {
      // Create source item
      const source = await prisma.item.create({
        data: {
          name: "Fork Private Test",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });

      // Clear cookies to ensure fresh sign-in (avoid redirect from previous session)
      await page.context().clearCookies();

      // Sign in as forker
      await signInPage.goto();
      await signInPage.signIn(forkerEmail, TEST_PASSWORD);
      await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });

      // Fork the item
      await publicProfilePage.gotoItem(ownerUsername, source.id);
      await publicProfilePage.forkItem();

      // Wait for fork to complete
      await expect(page.getByText(/forked/i)).toBeVisible({ timeout: 10000 });

      // Verify in database
      const forkedItem = await prisma.item.findFirst({
        where: { userId: forkerId, name: "Fork Private Test" },
      });

      expect(forkedItem).not.toBeNull();
      expect(forkedItem?.isPublic).toBe(false);
    });
  });

  test.describe("Visibility Toggle UI", () => {
    test.afterEach(async () => {
      await prisma.item.deleteMany({ where: { userId: ownerId } });
    });

    test("can toggle item from private to public via settings", async ({
      page,
      signInPage,
      itemsPage,
      publicProfilePage,
    }) => {
      // Create private item
      await prisma.item.create({
        data: {
          name: "Toggle To Public",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: false,
          inheritVisibility: false,
        },
      });

      // Clear cookies to ensure fresh sign-in (avoid redirect from previous session)
      await page.context().clearCookies();

      // Sign in as owner
      await signInPage.goto();
      await signInPage.signIn(ownerEmail, TEST_PASSWORD);
      await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });

      // Open settings (viewport-aware: context menu on desktop, Options sheet on mobile)
      await itemsPage.openItemSettings("Toggle To Public");

      const container = await itemsPage.getSettingsContainer();

      // Find and click the visibility toggle switch (labeled "Private" when off)
      const visibilitySwitch = container.getByRole("switch", {
        name: /private|public/i,
      });
      await visibilitySwitch.click();

      // Wait for server action to complete
      await expect(
        page.getByText(/item is now public/i, { exact: false })
      ).toBeVisible({ timeout: 5000 });

      // Close settings
      await itemsPage.closeSettings();

      // Sign out and verify visible on public profile
      await page.goto("/");
      await publicProfilePage.gotoProfile(ownerUsername);
      await publicProfilePage.expectItemVisible("Toggle To Public");
    });

    test("inherit option shown for non-root items", async ({
      page,
      signInPage,
    }) => {
      // Create parent and child
      const parent = await prisma.item.create({
        data: {
          name: "Parent For Inherit Test",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: true,
          inheritVisibility: false,
        },
      });

      const child = await prisma.item.create({
        data: {
          name: "Child For Inherit Test",
          userId: ownerId,
          parentId: parent.id,
          depth: 1,
          order: 0,
          isPublic: false,
          inheritVisibility: false,
        },
      });

      // Clear cookies to ensure fresh sign-in (avoid redirect from previous session)
      await page.context().clearCookies();

      // Sign in as owner
      await signInPage.goto();
      await signInPage.signIn(ownerEmail, TEST_PASSWORD);
      await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });

      // Navigate directly to child item's detail page
      const itemsPage = new ItemsPage(page, ownerUsername);
      await page.goto(`/u/${ownerUsername}/${child.id}`);
      await page.waitForLoadState("networkidle");

      // Open settings (viewport-aware)
      await itemsPage.openSettingsFromToolbar();
      const container = await itemsPage.getSettingsContainer();

      // Verify inherit option is visible for non-root item
      await expect(container.getByText(/inherit from parent/i)).toBeVisible();
    });

    test("inherit option NOT shown for root items", async ({
      page,
      signInPage,
    }) => {
      const rootItem = await prisma.item.create({
        data: {
          name: "Root No Inherit",
          userId: ownerId,
          depth: 0,
          order: 0,
          isPublic: false,
          inheritVisibility: false,
        },
      });

      // Clear cookies to ensure fresh sign-in (avoid redirect from previous session)
      await page.context().clearCookies();

      // Sign in as owner
      await signInPage.goto();
      await signInPage.signIn(ownerEmail, TEST_PASSWORD);
      await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });

      // Navigate directly to the root item's detail page
      const itemsPage = new ItemsPage(page, ownerUsername);
      await page.goto(`/u/${ownerUsername}/${rootItem.id}`);
      await page.waitForLoadState("networkidle");

      // Open settings (viewport-aware)
      await itemsPage.openSettingsFromToolbar();
      const container = await itemsPage.getSettingsContainer();

      // Verify inherit option is NOT visible for root item
      await expect(
        container.getByText(/inherit from parent/i)
      ).not.toBeVisible();
    });
  });
});
