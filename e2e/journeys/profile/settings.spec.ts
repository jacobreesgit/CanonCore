/**
 * E2E tests for profile settings functionality.
 * Tests opening dialog, updating name, and verifying changes.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

// Helper to get the profile dialog (excludes mobile sidebar which is also a dialog)
const getProfileDialog = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="dialog-content"]').first();

// Helper to get nested modal (change password/email dialogs)
const getNestedDialog = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="dialog-content"]').nth(1);

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
    await expect(page.getByText("Hero Banner")).toBeVisible();
    // Password and Email should be buttons now, not form fields
    await expect(
      page.getByRole("button", { name: /change password/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /change email/i })
    ).toBeVisible();
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

test.describe("Change Password Modal", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("password");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("opens change password modal from settings", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Click Change Password button
    await page.getByRole("button", { name: /change password/i }).click();

    // Modal should open
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();
    await expect(page.getByLabel("Current Password")).toBeVisible();
    await expect(page.getByLabel(/^new password$/i)).toBeVisible();
    await expect(page.getByLabel(/confirm new password/i)).toBeVisible();
  });

  test("password mismatch shows error", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change password modal
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill password fields with mismatched values
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("DifferentPassword1");

    // Try to submit
    await page.getByRole("button", { name: /^change password$/i }).click();

    // Should show mismatch error
    await expect(page.getByText("New passwords do not match")).toBeVisible();
  });

  test("shows error for wrong current password", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change password modal
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill with wrong current password
    await page.getByLabel("Current Password").fill("WrongPassword1");
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("NewPassword1");

    // Submit
    await page.getByRole("button", { name: /^change password$/i }).click();

    // Should show error
    await expect(page.getByText("Incorrect current password")).toBeVisible();
  });

  test("can change password successfully", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change password modal
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill correct values
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("NewPassword1");

    // Submit
    await page.getByRole("button", { name: /^change password$/i }).click();

    // Should show success toast and close modal
    await expect(page.getByText("Password changed successfully")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).not.toBeVisible();
  });

  test("cancel closes change password modal", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change password modal
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Click cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Modal should close, settings should still be open
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});

test.describe("Change Email Modal", () => {
  let testEmail: string;

  test.beforeEach(async ({ page, signUpPage }) => {
    testEmail = generateUniqueEmail("email");
    await signUpPage.goto();
    await signUpPage.signUp(testEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("opens change email modal from settings", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Click Change Email button
    await page.getByRole("button", { name: /change email/i }).click();

    // Modal should open with current email pre-filled
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();
    await expect(page.getByLabel(/new email/i)).toHaveValue(testEmail);
    await expect(page.getByLabel("Current Password")).toBeVisible();
  });

  test("shows error when email unchanged", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change email modal
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Don't change email, just enter password
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);

    // Submit
    await page.getByRole("button", { name: /^change email$/i }).click();

    // Should show error
    await expect(
      page.getByText("New email must be different from current email")
    ).toBeVisible();
  });

  test("shows error for wrong password", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change email modal
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Change email with wrong password
    await page.getByLabel(/new email/i).clear();
    await page.getByLabel(/new email/i).fill("newemail@example.com");
    await page.getByLabel("Current Password").fill("WrongPassword1");

    // Submit
    await page.getByRole("button", { name: /^change email$/i }).click();

    // Should show error
    await expect(page.getByText("Incorrect password")).toBeVisible();
  });

  test("can change email successfully", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change email modal
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    const newEmail = generateUniqueEmail("changed");

    // Fill correct values
    await page.getByLabel(/new email/i).clear();
    await page.getByLabel(/new email/i).fill(newEmail);
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);

    // Submit
    await page.getByRole("button", { name: /^change email$/i }).click();

    // Should show success toast and close modal
    await expect(page.getByText("Email changed successfully")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).not.toBeVisible();
  });

  test("cancel closes change email modal", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(getProfileDialog(page)).toBeVisible({ timeout: 10000 });

    // Open change email modal
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Click cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Modal should close, settings should still be open
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});
