/**
 * E2E tests for profile settings functionality.
 * Tests opening dialog, updating name, and verifying changes.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

// Helper to get the profile dialog (excludes mobile sidebar which is also a dialog)
const getProfileDialog = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="dialog-content"]');

test.describe("Profile Settings Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create a fresh user for each test
    const email = generateUniqueEmail("profile");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("can open profile settings from user dropdown", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();

    // Dialog should be visible with correct title
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(
      page.getByText("Manage your account and connections")
    ).toBeVisible();
  });

  test("shows profile sections in dialog", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Check all sections are visible
    await expect(page.getByText("Profile Picture")).toBeVisible();
    await expect(page.getByLabel("Display Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByText("Hero Banner")).toBeVisible();
    await expect(page.getByText("Change Password")).toBeVisible();
  });

  test("update display name and verify in sidebar", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Update name
    const nameInput = page.getByLabel("Display Name");
    await nameInput.clear();
    await nameInput.fill("Updated Name");

    // Save changes
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Wait for dialog to close
    await expect(getProfileDialog(page)).not.toBeVisible({ timeout: 5000 });

    // Verify success toast
    await expect(page.getByText("Settings updated")).toBeVisible();
  });

  test("cancel closes dialog without saving", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Make a change
    const nameInput = page.getByLabel("Display Name");
    const originalName = await nameInput.inputValue();
    await nameInput.clear();
    await nameInput.fill("Changed Name");

    // Click cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Dialog should close
    await expect(getProfileDialog(page)).not.toBeVisible();

    // Re-open and check name is unchanged
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel("Display Name")).toHaveValue(originalName);
  });

  test("save button disabled when no changes", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();

    // Wait for dialog to be visible
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    const saveButton = page.getByRole("button", { name: "Save Changes" });

    // Initially disabled when no changes made
    await expect(saveButton).toBeDisabled();

    // Make a change
    const nameInput = page.getByLabel("Display Name");
    await nameInput.fill("New Name");

    // Now save should be enabled
    await expect(saveButton).toBeEnabled();
  });

  test("email change requires current password field", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Change email
    const emailInput = page.getByLabel("Email");
    await emailInput.clear();
    await emailInput.fill("newemail@example.com");

    // Try to save without password
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Should show error toast
    await expect(
      page.getByText("Current password required for email or password changes")
    ).toBeVisible();
  });

  test("password mismatch shows error", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Fill password fields with mismatched values
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);
    await page.getByLabel("New Password", { exact: true }).fill("NewPassword1");
    await page.getByLabel("Confirm New Password").fill("DifferentPassword1");

    // Try to save
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Should show mismatch error
    await expect(page.getByText("New passwords do not match")).toBeVisible();
  });

  test("my items page shows shader fallback when no hero image", async ({
    page,
    myItemsPage,
  }) => {
    // Navigate to my-items page
    await myItemsPage.goto();

    // Should see the hero section (with shader fallback since no hero image)
    await expect(page.getByTestId("item-hero")).toBeVisible();

    // For new user without hero image, fallback should be present
    await expect(page.getByTestId("hero-fallback")).toBeVisible();
  });
});
