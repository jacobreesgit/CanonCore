/**
 * E2E tests for public profiles and item forking.
 * Tests viewing public profiles, public items, and fork functionality.
 */

import { test, expect, prisma } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Public Profiles Journey", () => {
  // Owner user credentials - created fresh for each test
  let ownerEmail: string;
  let ownerId: string;
  let ownerUsername: string;
  let publicItemId: string;

  test.beforeEach(async ({ page, signUpPage }) => {
    // Create owner with public profile
    ownerEmail = generateUniqueEmail("public-owner");
    ownerUsername = `testuser${Date.now()}`;

    await signUpPage.goto();
    await signUpPage.signUp(ownerEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Get owner ID and set public profile via database
    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail },
    });
    ownerId = owner!.id;

    // Make profile public with username
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        isPublic: true,
        username: ownerUsername,
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
    // Cleanup
    await prisma.item
      .deleteMany({ where: { userId: ownerId } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
  });

  test("can view public profile as unauthenticated user", async ({
    page,
    publicProfilePage,
  }) => {
    // Sign out first
    await page.getByTestId("my-items-user-menu").click();
    await page.getByTestId("my-items-sign-out-button").click();
    await page.waitForURL("/sign-in", { timeout: 10000 });

    // Visit public profile
    await publicProfilePage.gotoProfile(ownerUsername);
    await publicProfilePage.expectHeroVisible(ownerUsername);
    await publicProfilePage.expectItemVisible("Public Test Collection");
  });

  test("can view public item as unauthenticated user", async ({
    page,
    publicProfilePage,
  }) => {
    // Sign out first
    await page.getByTestId("my-items-user-menu").click();
    await page.getByTestId("my-items-sign-out-button").click();
    await page.waitForURL("/sign-in", { timeout: 10000 });

    // Visit public item
    await publicProfilePage.gotoItem(ownerUsername, publicItemId);
    await publicProfilePage.expectHeroVisible("Public Test Collection");

    // Should show sign-in to fork button
    await publicProfilePage.expectSignInToFork();
  });

  test("shows breadcrumb navigation on public item", async ({
    page,
    publicProfilePage,
  }) => {
    // Sign out first
    await page.getByTestId("my-items-user-menu").click();
    await page.getByTestId("my-items-sign-out-button").click();
    await page.waitForURL("/sign-in", { timeout: 10000 });

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
  }) => {
    // Sign out first
    await page.getByTestId("my-items-user-menu").click();
    await page.getByTestId("my-items-sign-out-button").click();
    await page.waitForURL("/sign-in", { timeout: 10000 });

    // Visit public profile
    await publicProfilePage.gotoProfile(ownerUsername);

    // Click on item
    await publicProfilePage.clickItem("Public Test Collection");
    await expect(page).toHaveURL(`/u/${ownerUsername}/${publicItemId}`);
    await publicProfilePage.expectHeroVisible("Public Test Collection");
  });

  test("shows empty state when profile has no public items", async ({
    page,
    signUpPage,
    publicProfilePage,
  }) => {
    // Create another user with no items
    const emptyUserEmail = generateUniqueEmail("empty-profile");
    const emptyUsername = `emptyuser${Date.now()}`;

    // Sign out current user
    await page.getByTestId("my-items-user-menu").click();
    await page.getByTestId("my-items-sign-out-button").click();
    await page.waitForURL("/sign-in", { timeout: 10000 });

    // Create empty user via sign up
    await signUpPage.goto();
    await signUpPage.signUp(emptyUserEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Get empty user ID and make public
    const emptyUser = await prisma.user.findUnique({
      where: { email: emptyUserEmail },
    });
    await prisma.user.update({
      where: { id: emptyUser!.id },
      data: { isPublic: true, username: emptyUsername },
    });

    // Sign out
    await page.getByTestId("my-items-user-menu").click();
    await page.getByTestId("my-items-sign-out-button").click();
    await page.waitForURL("/sign-in", { timeout: 10000 });

    // Visit empty profile
    await publicProfilePage.gotoProfile(emptyUsername);
    await publicProfilePage.expectEmptyState();

    // Cleanup
    await prisma.user.delete({ where: { id: emptyUser!.id } }).catch(() => {});
  });
});

test.describe("Fork Journey", () => {
  let ownerEmail: string;
  let ownerId: string;
  let ownerUsername: string;
  let publicItemId: string;

  test.beforeEach(async () => {
    // Create owner with public profile directly in DB
    ownerEmail = generateUniqueEmail("fork-owner");
    ownerUsername = `forkowner${Date.now()}`;

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
    signUpPage,
    publicProfilePage,
  }) => {
    // Create forker user via sign up
    const forkerEmail = generateUniqueEmail("forker");
    await signUpPage.goto();
    await signUpPage.signUp(forkerEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

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

    // Cleanup forker
    const forker = await prisma.user.findUnique({
      where: { email: forkerEmail },
    });
    if (forker) {
      await prisma.item
        .deleteMany({ where: { userId: forker.id } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: forker.id } }).catch(() => {});
    }
  });

  test("forked item appears in user library", async ({
    page,
    signUpPage,
    publicProfilePage,
    itemsPage,
  }) => {
    // Create forker user via sign up
    const forkerEmail = generateUniqueEmail("forker-lib");
    await signUpPage.goto();
    await signUpPage.signUp(forkerEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Visit and fork
    await publicProfilePage.gotoItem(ownerUsername, publicItemId);
    await publicProfilePage.forkItem();
    await publicProfilePage.expectSuccessToast(/added to your library/i);
    await publicProfilePage.waitForToastToDisappear();

    // Go to my items
    await itemsPage.goto();

    // Forked item should appear
    await itemsPage.expectItemVisible("Forkable Collection");

    // Cleanup forker
    const forker = await prisma.user.findUnique({
      where: { email: forkerEmail },
    });
    if (forker) {
      await prisma.item
        .deleteMany({ where: { userId: forker.id } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: forker.id } }).catch(() => {});
    }
  });

  test("cannot fork own item", async ({
    page,
    signInPage,
    publicProfilePage,
  }) => {
    // Sign in as owner
    await signInPage.goto();
    await signInPage.signIn(ownerEmail, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Visit own public item
    await publicProfilePage.gotoItem(ownerUsername, publicItemId);
    await publicProfilePage.expectHeroVisible("Forkable Collection");

    // Fork button should NOT be visible (it's your own item)
    await expect(publicProfilePage.forkButton).not.toBeVisible();
    await expect(publicProfilePage.forkInLibraryButton).not.toBeVisible();
  });
});
