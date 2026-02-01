/**
 * E2E tests for profile settings file upload functionality.
 * Tests FileUpload integration for profile picture and hero banner.
 */

import { test, expect } from "../../fixtures";
import path from "path";

// Helper to get the profile dialog
const getProfileDialog = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="dialog-content"]').first();

// Helper to get file input from FileUpload component containing the testid element
const getFileInput = (page: import("@playwright/test").Page, testId: string) =>
  page
    .locator(`[data-slot="file-upload"]`)
    .filter({ has: page.getByTestId(testId) })
    .locator('input[type="file"]');

test.describe("Profile Picture Upload", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can upload profile picture via dropzone", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Find the FileUpload component's file input
    const input = getFileInput(page, "profile-dropzone");

    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Save button should be enabled after upload
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();

    // Avatar should now show the uploaded image
    const avatar = page.getByTestId("profile-dropzone").locator("img");
    await expect(avatar).toBeVisible();
  });

  test("can remove profile picture after saving", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload first
    const input = getFileInput(page, "profile-dropzone");
    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Save to persist the image
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(getProfileDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Re-open settings
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Now "Remove Avatar" button should be visible (for saved images)
    const removeButton = page.getByRole("button", { name: /remove avatar/i });
    await expect(removeButton).toBeVisible();

    // Click remove
    await removeButton.click();

    // Remove button should disappear
    await expect(removeButton).not.toBeVisible();

    // Save should be enabled (removing is a change)
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();
  });

  test("shows avatar with upload button initially", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Should show the profile dropzone with avatar area
    const dropzone = page.getByTestId("profile-dropzone");
    await expect(dropzone).toBeVisible();

    // Should have an upload button on the avatar
    const uploadButton = dropzone.getByRole("button");
    await expect(uploadButton).toBeVisible();
  });
});

test.describe("Hero Banner Upload", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can upload hero banner via dropzone", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Find the FileUpload component's file input
    const input = getFileInput(page, "hero-dropzone");

    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-hero.jpg")
    );

    // Save button should be enabled after upload
    const saveButton = page.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled();

    // Clear button (X icon) should appear next to "Change Cover"
    const heroDropzone = page.getByTestId("hero-dropzone");
    const clearButton = heroDropzone.locator("button:has(svg.lucide-x)");
    await expect(clearButton).toBeVisible();
  });

  test("can remove hero banner after upload", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload first
    const input = getFileInput(page, "hero-dropzone");
    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-hero.jpg")
    );

    // Click the X button to clear
    const heroDropzone = page.getByTestId("hero-dropzone");
    const clearButton = heroDropzone.locator("button:has(svg.lucide-x)");
    await clearButton.click();

    // Clear button should disappear
    await expect(clearButton).not.toBeVisible();
  });

  test("shows hero dropzone with Change Cover button initially", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Should show the hero dropzone area
    const heroDropzone = page.getByTestId("hero-dropzone");
    await expect(heroDropzone).toBeVisible();

    // Should have "Change Cover" button
    await expect(
      page.getByRole("button", { name: /change cover/i })
    ).toBeVisible();
  });
});

test.describe("Upload and Save Flow", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can upload profile picture and save", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload profile picture
    const input = getFileInput(page, "profile-dropzone");
    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Dialog should close
    await expect(getProfileDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Success toast should appear
    await expect(page.getByText("Settings saved")).toBeVisible();
  });

  test("can upload both profile and hero and save", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload profile picture
    const profileInput = getFileInput(page, "profile-dropzone");
    await profileInput.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Upload hero banner
    const heroInput = getFileInput(page, "hero-dropzone");
    await heroInput.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-hero.jpg")
    );

    // Hero clear button (X icon) should be visible
    const heroDropzone = page.getByTestId("hero-dropzone");
    const clearButton = heroDropzone.locator("button:has(svg.lucide-x)");
    await expect(clearButton).toBeVisible();

    // Save changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // Dialog should close
    await expect(getProfileDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Success toast should appear
    await expect(page.getByText("Settings saved")).toBeVisible();
  });

  test("cancel discards upload changes", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Upload profile picture
    const input = getFileInput(page, "profile-dropzone");
    await input.setInputFiles(
      path.join(__dirname, "../../fixtures/images/test-avatar.jpg")
    );

    // Cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Dialog should close
    await expect(getProfileDialog(page)).not.toBeVisible();

    // Re-open and check no image is saved (no Remove Avatar button)
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Remove Avatar button should not be visible (no saved image)
    await expect(
      page.getByRole("button", { name: /remove avatar/i })
    ).not.toBeVisible();
  });
});
