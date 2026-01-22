/**
 * E2E tests for public profiles and item forking.
 * Tests viewing public profiles, public items, and fork functionality.
 */

import { test, expect, prisma } from "../../fixtures";
import {
  generateUniqueEmail,
  generateUniqueUsername,
  TEST_PASSWORD,
} from "../../helpers/test-user";

test.describe("Public Profiles Journey", () => {
  // Run serially to avoid database conflicts with shared user state
  test.describe.configure({ mode: "serial" });

  // Owner user credentials - created fresh for each test
  let ownerId: string;
  let ownerUsername: string;
  let publicItemId: string;

  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Store testUser info for tests
    ownerId = testUser.id;
    ownerUsername = testUser.username;

    // Make profile public
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        isPublic: true,
      },
    });

    // Create a public item
    const item = await prisma.item.create({
      data: {
        name: "Public Test Collection",
        description: "A test collection for E2E testing",
        userId: ownerId,
        depth: 0,
        order: 0,
        isPublic: true,
      },
    });
    publicItemId = item.id;
  });

  test.afterEach(async () => {
    // Cleanup items created in test (testUser fixture handles user cleanup)
    await prisma.item
      .deleteMany({ where: { userId: ownerId } })
      .catch(() => {});
  });

  test("can view public profile as unauthenticated user", async ({
    page,
    publicProfilePage,
    myItemsPage,
  }) => {
    // Sign out first (handles mobile sidebar)
    await myItemsPage.signOut();
    await page.waitForURL("/", { timeout: 10000 });

    // Visit public profile
    await publicProfilePage.gotoProfile(ownerUsername);
    await publicProfilePage.expectProfileHeroVisible(ownerUsername);
    await publicProfilePage.expectItemVisible("Public Test Collection");
  });

  test("can view public item as unauthenticated user", async ({
    page,
    publicProfilePage,
    myItemsPage,
  }) => {
    // Sign out first (handles mobile sidebar)
    await myItemsPage.signOut();
    await page.waitForURL("/", { timeout: 10000 });

    // Visit public item
    await publicProfilePage.gotoItem(ownerUsername, publicItemId);
    await publicProfilePage.expectHeroVisible("Public Test Collection");

    // Should show sign-in to fork button
    await publicProfilePage.expectSignInToFork();
  });

  test("shows breadcrumb navigation on public item", async ({
    page,
    publicProfilePage,
    myItemsPage,
  }) => {
    // Sign out first (handles mobile sidebar)
    await myItemsPage.signOut();
    await page.waitForURL("/", { timeout: 10000 });

    // Visit public item
    await publicProfilePage.gotoItem(ownerUsername, publicItemId);

    // Breadcrumb should show username and item name
    await expect(publicProfilePage.breadcrumb).toContainText(
      `@${ownerUsername}`
    );
    await expect(publicProfilePage.breadcrumb).toContainText(
      "Public Test Collection"
    );

    // Click back should navigate to profile
    await publicProfilePage.clickBreadcrumbBack();
    await expect(page).toHaveURL(`/u/${ownerUsername}`);
  });

  test("can navigate from profile to item", async ({
    page,
    publicProfilePage,
    myItemsPage,
  }) => {
    // Sign out first (handles mobile sidebar)
    await myItemsPage.signOut();
    await page.waitForURL("/", { timeout: 10000 });

    // Visit public profile
    await publicProfilePage.gotoProfile(ownerUsername);

    // Click on item
    await publicProfilePage.clickItem("Public Test Collection");
    await expect(page).toHaveURL(`/u/${ownerUsername}/${publicItemId}`);
    await publicProfilePage.expectHeroVisible("Public Test Collection");
  });

  test("shows empty state when profile has no public items", async ({
    page,
    publicProfilePage,
    myItemsPage,
  }) => {
    // Create another user with no items directly in DB
    const emptyUserEmail = generateUniqueEmail("empty-profile");
    const emptyUsername = generateUniqueUsername("em");

    const { hash } = await import("bcryptjs");
    const passwordHash = await hash(TEST_PASSWORD, 10);

    const emptyUser = await prisma.user.create({
      data: {
        email: emptyUserEmail,
        passwordHash,
        isPublic: true,
        username: emptyUsername,
      },
    });

    // Sign out current user (handles mobile sidebar)
    await myItemsPage.signOut();
    await page.waitForURL("/", { timeout: 10000 });

    // Visit empty profile
    await publicProfilePage.gotoProfile(emptyUsername);
    await publicProfilePage.expectEmptyState();

    // Cleanup
    await prisma.user.delete({ where: { id: emptyUser.id } }).catch(() => {});
  });
});

test.describe("Public Profile Enablement Journey", () => {
  // Run serially to avoid database conflicts with shared user state
  test.describe.configure({ mode: "serial" });

  let userId: string;

  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Store user ID for tests
    userId = testUser.id;
  });

  test.afterEach(async () => {
    // Cleanup items created in test (testUser fixture handles user cleanup)
    await prisma.item.deleteMany({ where: { userId } }).catch(() => {});
  });

  test("can enable public profile via settings", async ({
    page,
    settingsPage,
    publicProfilePage,
  }) => {
    const username = generateUniqueUsername();

    // Open settings
    await settingsPage.openFromNavUser();

    // Set username
    await settingsPage.setUsername(username);
    await settingsPage.waitForUsernameValidation();
    expect(await settingsPage.isUsernameAvailable()).toBe(true);

    // Enable public profile
    await settingsPage.togglePublicProfile();
    await settingsPage.confirmMakePublic();
    expect(await settingsPage.isPublicProfileEnabled()).toBe(true);

    // Save changes (waits for toast confirmation internally)
    await settingsPage.saveChanges();

    // Ensure settings dialog is fully closed before navigating
    await expect(
      page.getByRole("dialog", { name: /settings/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Verify profile is accessible publicly
    await publicProfilePage.gotoProfile(username);
    await expect(page).toHaveURL(`/u/${username}`);
  });

  test("shows confirmation dialog when enabling public profile", async ({
    page,
    settingsPage,
  }) => {
    // Open settings
    await settingsPage.openFromNavUser();

    // Set a username first
    const username = generateUniqueUsername("cf");
    await settingsPage.setUsername(username);
    await settingsPage.waitForUsernameValidation();

    // Toggle public - should show confirmation
    await settingsPage.togglePublicProfile();

    // Verify confirmation dialog appears
    await expect(
      page.getByRole("alertdialog", { name: /make your profile public/i })
    ).toBeVisible();

    // Cancel - switch should remain off
    await settingsPage.cancelMakePublic();
    expect(await settingsPage.isPublicProfileEnabled()).toBe(false);

    // Toggle again and confirm
    await settingsPage.togglePublicProfile();
    await settingsPage.confirmMakePublic();
    expect(await settingsPage.isPublicProfileEnabled()).toBe(true);
  });

  test("validates username availability", async ({ settingsPage }) => {
    // First create a user with an existing username
    const existingUsername = generateUniqueUsername("ex");
    await prisma.user.create({
      data: {
        email: `existing-${Date.now()}@test.example.com`,
        passwordHash: "hashedpassword",
        username: existingUsername,
        isPublic: true,
      },
    });

    try {
      // Open settings
      await settingsPage.openFromNavUser();

      // Try to use existing username
      await settingsPage.setUsername(existingUsername);
      await settingsPage.waitForUsernameValidation();

      // Should show as taken
      expect(await settingsPage.isUsernameTaken()).toBe(true);

      // Change to available username
      const availableUsername = generateUniqueUsername("av");
      await settingsPage.setUsername(availableUsername);
      await settingsPage.waitForUsernameValidation();

      // Should show as available
      expect(await settingsPage.isUsernameAvailable()).toBe(true);
    } finally {
      // Cleanup existing user
      await prisma.user
        .deleteMany({ where: { username: existingUsername } })
        .catch(() => {});
    }
  });

  test("shows public profile URL preview", async ({ settingsPage }) => {
    // Open settings
    await settingsPage.openFromNavUser();

    // Set username
    const username = generateUniqueUsername("pv");
    await settingsPage.setUsername(username);

    // Verify URL preview updates
    const preview = await settingsPage.getPublicUrlPreview();
    expect(preview).toContain(`canoncore.com/u/${username}`);
  });

  test("can disable public profile", async ({
    page,
    settingsPage,
    publicProfilePage,
  }) => {
    const username = generateUniqueUsername("ds");

    // First enable public profile via DB
    await prisma.user.update({
      where: { id: userId },
      data: { username, isPublic: true },
    });

    // Reload page
    await page.reload();

    // Verify profile is accessible
    await publicProfilePage.gotoProfile(username);
    await expect(page).toHaveURL(`/u/${username}`);

    // Go back to user's profile page
    await page.goto(`/u/${username}`);

    // Open settings and disable
    await settingsPage.openFromNavUser();
    expect(await settingsPage.isPublicProfileEnabled()).toBe(true);

    await settingsPage.togglePublicProfile();
    expect(await settingsPage.isPublicProfileEnabled()).toBe(false);

    // Save changes (waits for toast confirmation internally)
    await settingsPage.saveChanges();

    // Verify profile is no longer accessible (should show 404)
    await publicProfilePage.gotoProfile(username);
    // Private profile returns 404 - Next.js shows "This page could not be found"
    await expect(
      page.getByText(/not found|could not be found|doesn't exist/i)
    ).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("Fork Journey", () => {
  // Run serially to avoid database conflicts with shared user state
  test.describe.configure({ mode: "serial" });

  let ownerEmail: string;
  let ownerId: string;
  let ownerUsername: string;
  let publicItemId: string;

  test.beforeEach(async () => {
    // Create owner with public profile directly in DB
    ownerEmail = generateUniqueEmail("fork-owner");
    ownerUsername = generateUniqueUsername("fk");

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

    // Create a public item to fork
    const item = await prisma.item.create({
      data: {
        name: "Forkable Collection",
        description: "A collection that can be forked",
        userId: ownerId,
        depth: 0,
        order: 0,
        isPublic: true,
      },
    });
    publicItemId = item.id;
  });

  test.afterEach(async () => {
    // Cleanup owner and their items
    await prisma.item
      .deleteMany({ where: { userId: ownerId } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
  });

  test("can fork item as authenticated user", async ({
    page,
    testUser,
    publicProfilePage,
  }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Visit public item
    await publicProfilePage.gotoItem(ownerUsername, publicItemId);
    await publicProfilePage.expectHeroVisible("Forkable Collection");

    // Fork button should be visible
    await publicProfilePage.expectForkButtonVisible();

    // Fork the item
    await publicProfilePage.forkItem();

    // Should show success toast
    await publicProfilePage.expectSuccessToast(/added to your library/i);

    // Button should change to "In Your Library"
    await publicProfilePage.expectAlreadyForked();

    // Cleanup forked items (testUser fixture handles user cleanup)
    await prisma.item
      .deleteMany({ where: { userId: testUser.id } })
      .catch(() => {});
  });

  test("forked item appears in user library", async ({
    page,
    testUser,
    publicProfilePage,
    itemsPage,
  }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Visit and fork
    await publicProfilePage.gotoItem(ownerUsername, publicItemId);
    await publicProfilePage.forkItem();
    await publicProfilePage.expectSuccessToast(/added to your library/i);
    await publicProfilePage.waitForToastToDisappear();

    // Go to my items
    await itemsPage.goto();

    // Forked item should appear
    await itemsPage.expectItemVisible("Forkable Collection");

    // Cleanup forked items (testUser fixture handles user cleanup)
    await prisma.item
      .deleteMany({ where: { userId: testUser.id } })
      .catch(() => {});
  });

  test("cannot fork own item", async ({
    page,
    signInPage,
    publicProfilePage,
  }) => {
    // Sign in as owner
    await signInPage.goto();
    await signInPage.signIn(ownerEmail, TEST_PASSWORD);
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/, { timeout: 10000 });

    // Visit own public item
    await publicProfilePage.gotoItem(ownerUsername, publicItemId);
    await publicProfilePage.expectHeroVisible("Forkable Collection");

    // Fork button should NOT be visible (it's your own item)
    await expect(publicProfilePage.forkButton).not.toBeVisible();
    await expect(publicProfilePage.forkInLibraryButton).not.toBeVisible();
  });
});

test.describe("Public Item View Toggle and Hero Collapse Journey", () => {
  // Run serially to avoid database conflicts with shared user state
  test.describe.configure({ mode: "serial" });

  let ownerEmail: string;
  let ownerId: string;
  let ownerUsername: string;
  let parentItemId: string;
  let childItemId: string;

  test.beforeEach(async () => {
    // Create owner with public profile directly in DB
    ownerEmail = generateUniqueEmail("view-toggle");
    ownerUsername = generateUniqueUsername("vt");

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

    // Create a public parent item with a child
    const parentItem = await prisma.item.create({
      data: {
        name: "Parent Collection",
        description: "A parent collection for testing views",
        userId: ownerId,
        depth: 0,
        order: 0,
        isPublic: true,
      },
    });
    parentItemId = parentItem.id;

    // Create a public child item
    const childItem = await prisma.item.create({
      data: {
        name: "Child Item",
        description: "A child item for testing tree view",
        userId: ownerId,
        parentId: parentItemId,
        depth: 1,
        order: 0,
        isPublic: true,
      },
    });
    childItemId = childItem.id;
  });

  test.afterEach(async () => {
    // Cleanup owner and their items
    await prisma.item
      .deleteMany({ where: { userId: ownerId } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
  });

  test("can switch between tree and grid views on public item", async ({
    page,
    publicProfilePage,
  }) => {
    // Visit public item (default is grid view from localStorage or default)
    await publicProfilePage.gotoItem(ownerUsername, parentItemId);
    await publicProfilePage.expectHeroVisible("Parent Collection");

    // Initially grid view should be visible (default)
    await publicProfilePage.expectGridViewVisible();

    // Switch to tree view
    await publicProfilePage.switchToTreeView();
    await publicProfilePage.expectTreeViewVisible();

    // Verify child item is visible in tree
    await publicProfilePage.expectItemInTree("Child Item");

    // Switch back to grid view
    await publicProfilePage.switchToGridView();
    await publicProfilePage.expectGridViewVisible();

    // Verify child is visible in grid
    await publicProfilePage.expectItemVisible("Child Item");
  });

  test("view toggle persists across page navigation", async ({
    page,
    publicProfilePage,
  }) => {
    // Visit public item
    await publicProfilePage.gotoItem(ownerUsername, parentItemId);
    await publicProfilePage.expectHeroVisible("Parent Collection");

    // Switch to tree view
    await publicProfilePage.switchToTreeView();
    await publicProfilePage.expectTreeViewVisible();

    // Navigate to child item and back
    await publicProfilePage.gotoItem(ownerUsername, childItemId);
    await publicProfilePage.expectHeroVisible("Child Item");

    // Go back to parent
    await publicProfilePage.gotoItem(ownerUsername, parentItemId);

    // Tree view should still be selected (persisted in localStorage)
    await publicProfilePage.expectTreeViewVisible();
  });

  test("view toggle is disabled when no children", async ({
    page,
    publicProfilePage,
  }) => {
    // Visit child item (which has no children)
    await publicProfilePage.gotoItem(ownerUsername, childItemId);
    await publicProfilePage.expectHeroVisible("Child Item");

    // View toggle should be disabled
    await expect(publicProfilePage.viewToggleTree).toBeDisabled();
    await expect(publicProfilePage.viewToggleGrid).toBeDisabled();
  });
});
