/**
 * E2E tests for profile settings file upload functionality.
 * Tests dropzone integration for profile picture and hero banner.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import path from "path";

// Helper to get the profile dialog
const getProfileDialog = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="dialog-content"]').first();

test.describe("Profile Picture Upload", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("upload");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("can upload profile picture via dropzone", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Find the dropzone's file input and upload
    const dropzone = page.getByTestId("profile-dropzone");
    const input = dropzone.locator('input[type="file"]');

    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Save button should be enabled after upload
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();

    // Remove button should appear
    await expect(page.getByRole("button", { name: /^remove$/i })).toBeVisible();
  });

  test("can remove profile picture after upload", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload first
    const dropzone = page.getByTestId("profile-dropzone");
    const input = dropzone.locator('input[type="file"]');
    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Click remove
    await page.getByRole("button", { name: /^remove$/i }).click();

    // Remove button should disappear
    await expect(
      page.getByRole("button", { name: /^remove$/i })
    ).not.toBeVisible();

    // Save should still be enabled (removing is a change)
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();
  });

  test("shows dropzone empty state initially", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Should show upload instructions
    await expect(
      page.getByText(/Drag and drop or click to upload/i).first()
    ).toBeVisible();
  });
});

test.describe("Hero Banner Upload", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("hero");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("can upload hero banner via dropzone", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Find the hero dropzone's file input and upload
    const dropzone = page.getByTestId("hero-dropzone");
    const input = dropzone.locator('input[type="file"]');

    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-hero.jpg")
    );

    // Save button should be enabled after upload
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();

    // Remove banner button should appear
    await expect(
      page.getByRole("button", { name: /remove banner/i })
    ).toBeVisible();
  });

  test("can remove hero banner after upload", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload first
    const dropzone = page.getByTestId("hero-dropzone");
    const input = dropzone.locator('input[type="file"]');
    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-hero.jpg")
    );

    // Click remove
    await page.getByRole("button", { name: /remove banner/i }).click();

    // Remove button should disappear
    await expect(
      page.getByRole("button", { name: /remove banner/i })
    ).not.toBeVisible();
  });

  test("shows hero dropzone empty state initially", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Should show the hero section with empty state
    await expect(page.getByText("Hero Banner")).toBeVisible();
    await expect(
      page.getByText("Displayed at the top of your My Items page")
    ).toBeVisible();
  });
});

test.describe("Upload and Save Flow", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("save");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("can upload profile picture and save", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload profile picture
    const dropzone = page.getByTestId("profile-dropzone");
    const input = dropzone.locator('input[type="file"]');
    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Dialog should close
    await expect(getProfileDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Success toast should appear
    await expect(page.getByText("Settings updated")).toBeVisible();
  });

  test("can upload both profile and hero and save", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload profile picture
    const profileDropzone = page.getByTestId("profile-dropzone");
    const profileInput = profileDropzone.locator('input[type="file"]');
    await profileInput.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Upload hero banner
    const heroDropzone = page.getByTestId("hero-dropzone");
    const heroInput = heroDropzone.locator('input[type="file"]');
    await heroInput.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-hero.jpg")
    );

    // Both remove buttons should be visible
    await expect(page.getByRole("button", { name: /^remove$/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /remove banner/i })
    ).toBeVisible();

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Dialog should close
    await expect(getProfileDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Success toast should appear
    await expect(page.getByText("Settings updated")).toBeVisible();
  });

  test("cancel discards upload changes", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload profile picture
    const dropzone = page.getByTestId("profile-dropzone");
    const input = dropzone.locator('input[type="file"]');
    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Dialog should close
    await expect(getProfileDialog(page)).not.toBeVisible();

    // Re-open and check no image is set
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Remove button should not be visible (no image saved)
    await expect(
      page.getByRole("button", { name: /^remove$/i })
    ).not.toBeVisible();
  });
});
