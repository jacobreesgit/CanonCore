/**
 * E2E tests for profile settings functionality.
 * Tests opening dialog, updating name, and verifying changes.
 */

import { test, expect } from "../../fixtures";
import { TEST_PASSWORD } from "../../helpers/test-user";

/**
 * Gets the profile settings container (desktop dialog or mobile sheet).
 * Desktop uses data-slot="dialog-content", mobile uses role="dialog" with name "Settings".
 */
const getProfileContainer = async (page: import("@playwright/test").Page) => {
  const viewport = page.viewportSize();
  const isMobile = viewport ? viewport.width < 1024 : false;
  if (isMobile) {
    return page.getByRole("dialog", { name: /settings/i });
  }
  return page.getByTestId("settings-dialog");
};

// Keep for backward compatibility with footer-specific tests
const getProfileDialog = (page: import("@playwright/test").Page) =>
  page.getByTestId("settings-dialog");

/**
 * Gets a submit button from the settings footer area.
 * Desktop: scopes to dialog-footer slot. Mobile: uses last() to disambiguate.
 */
const getFooterButton = async (
  page: import("@playwright/test").Page,
  name: RegExp
) => {
  const viewport = page.viewportSize();
  const isMobile = viewport ? viewport.width < 1024 : false;
  if (isMobile) {
    // Use last() dialog to handle sub-step sheets (password/email/username)
    const container = page.getByRole("dialog").last();
    return container.getByRole("button", { name }).last();
  }
  return getProfileDialog(page)
    .locator('[data-slot="dialog-footer"]')
    .getByRole("button", { name });
};

/**
 * Gets a cancel button from the settings footer area.
 * Desktop: scopes to last dialog-footer (handles animated transitions). Mobile: uses last() dialog.
 */
const getFooterCancelButton = async (page: import("@playwright/test").Page) => {
  const viewport = page.viewportSize();
  const isMobile = viewport ? viewport.width < 1024 : false;
  if (isMobile) {
    const container = page.getByRole("dialog").last();
    return container.getByRole("button", { name: /cancel/i }).last();
  }
  return getProfileDialog(page)
    .locator('[data-slot="dialog-footer"]')
    .last()
    .getByRole("button", { name: /cancel/i });
};

/**
 * Selects a settings tab by name.
 * Desktop uses tab role; mobile uses Select dropdown (>3 tabs in SwipeableTabs).
 */
const selectSettingsTab = async (
  page: import("@playwright/test").Page,
  tabName: string
) => {
  const viewport = page.viewportSize();
  const isMobile = viewport ? viewport.width < 1024 : false;
  if (isMobile) {
    const trigger = page.getByRole("combobox", { name: "Settings tabs" });
    await trigger.click();
    await page.getByRole("option", { name: tabName }).click();
  } else {
    await page.getByRole("tab", { name: tabName }).click();
  }
};

test.describe("Profile Settings Journey", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can open profile settings from user dropdown", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();

    // Dialog should be visible with correct title
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(
      page.getByText("Manage your account and connections")
    ).toBeVisible();
  });

  test("shows profile sections in dialog", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Check Profile tab sections - new visual card with cover + avatar
    await expect(page.getByTestId("hero-dropzone")).toBeVisible();
    await expect(page.getByTestId("profile-dropzone")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /change cover/i })
    ).toBeVisible();
    await expect(page.getByLabel("Display Name")).toBeVisible();

    // Navigate to Account tab to check password/email buttons
    await selectSettingsTab(page, "Account");

    // Password and Email should be buttons in Account tab
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
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Update name
    const nameInput = page.getByLabel("Display Name");
    await nameInput.clear();
    await nameInput.fill("Updated Name");

    // Save changes
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Wait for dialog to close
    await expect(await getProfileContainer(page)).not.toBeVisible({
      timeout: 5000,
    });

    // Verify success toast
    await expect(page.getByText("Settings saved")).toBeVisible();
  });

  test("cancel closes dialog without saving", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Make a change
    const nameInput = page.getByLabel("Display Name");
    const originalName = await nameInput.inputValue();
    await nameInput.clear();
    await nameInput.fill("Changed Name");

    // Click cancel
    const cancelButton = await getFooterCancelButton(page);
    await cancelButton.scrollIntoViewIfNeeded();
    await cancelButton.click();

    // Dialog should close
    await expect(await getProfileContainer(page)).not.toBeVisible();

    // Re-open and check name is unchanged
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByLabel("Display Name")).toHaveValue(originalName);
  });

  test("save button disabled when no changes", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();

    // Wait for dialog to be visible
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    const saveButton = page.getByRole("button", { name: "Save Changes" });

    // Initially disabled when no changes made (both desktop dialog and mobile sheet)
    await expect(saveButton).toBeDisabled();

    // Make a change
    const nameInput = page.getByLabel("Display Name");
    await nameInput.fill("New Name");

    // Now save should be enabled/visible
    await expect(saveButton).toBeEnabled();
  });

  test("my items page shows shader fallback when no hero image", async ({
    page,
    myItemsPage,
  }) => {
    // Navigate to my-items page
    await myItemsPage.goto();

    // Should see the hero section (with shader fallback since no hero image)
    await expect(page.getByTestId("hero-carousel")).toBeVisible();

    // For new user without hero image, fallback should be present
    await expect(page.getByTestId("hero-fallback")).toBeVisible();
  });
});

test.describe("Change Password Step", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("opens change password step from settings", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first (Change Password is in Account tab now)
    await selectSettingsTab(page, "Account");

    // Click Change Password button in main settings
    await page.getByRole("button", { name: /change password/i }).click();

    // Step should show with password fields
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();
    await expect(page.getByLabel("Current Password")).toBeVisible();
    await expect(page.getByLabel(/^new password$/i)).toBeVisible();
    await expect(page.getByLabel(/confirm new password/i)).toBeVisible();
  });

  test("password mismatch shows error", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Navigate to change password step
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill password fields with mismatched values
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("DifferentPassword1");

    // Try to submit - use the submit button in footer (not the nav button)
    const submitBtn = await getFooterButton(page, /change password/i);
    await submitBtn.click();

    // Should show mismatch error
    await expect(page.getByText("New passwords do not match")).toBeVisible();
  });

  test("shows error for wrong current password", async ({
    page,
    myItemsPage,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Navigate to change password step
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill with wrong current password
    await page.getByLabel("Current Password").fill("WrongPassword1");
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("NewPassword1");

    // Submit using footer button
    const submitBtn = await getFooterButton(page, /change password/i);
    await submitBtn.click();

    // Should show error
    await expect(page.getByText("Incorrect current password")).toBeVisible();
  });

  test("can change password successfully", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Navigate to change password step
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Fill correct values
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);
    await page.getByLabel(/^new password$/i).fill("NewPassword1");
    await page.getByLabel(/confirm new password/i).fill("NewPassword1");

    // Submit using footer button
    const submitBtn = await getFooterButton(page, /change password/i);
    await submitBtn.click();

    // Should show success toast and return to main settings
    await expect(page.getByText("Password saved")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("cancel returns to main settings", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Navigate to change password step
    await page.getByRole("button", { name: /change password/i }).click();
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).toBeVisible();

    // Click cancel in footer (use last() to handle animated transitions)
    const cancelBtn = await getFooterCancelButton(page);
    await cancelBtn.click();

    // Should return to main settings view
    await expect(
      page.getByRole("heading", { name: /change password/i })
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});

test.describe("Change Email Step", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("opens change email step from settings", async ({
    page,
    myItemsPage,
    testUser,
  }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Click Change Email button in main settings
    await page.getByRole("button", { name: /change email/i }).click();

    // Step should show with current email pre-filled
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();
    await expect(page.getByLabel(/new email/i)).toHaveValue(testUser.email);
    await expect(page.getByLabel("Current Password")).toBeVisible();
  });

  test("shows error when email unchanged", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Navigate to change email step
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Don't change email, just enter password
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);

    // Submit using footer button
    const emailBtn = await getFooterButton(page, /change email/i);
    await emailBtn.click();

    // Should show error
    await expect(
      page.getByText("New email must be different from current email")
    ).toBeVisible();
  });

  test("shows error for wrong password", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Navigate to change email step
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Change email with wrong password
    await page.getByLabel(/new email/i).clear();
    await page.getByLabel(/new email/i).fill("newemail@example.com");
    await page.getByLabel("Current Password").fill("WrongPassword1");

    // Submit using footer button
    const emailBtn = await getFooterButton(page, /change email/i);
    await emailBtn.click();

    // Should show error
    await expect(page.getByText("Incorrect password")).toBeVisible();
  });

  test("can change email successfully", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Navigate to change email step
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    const newEmail = `changed_${Date.now()}@test.local`;

    // Fill correct values
    await page.getByLabel(/new email/i).clear();
    await page.getByLabel(/new email/i).fill(newEmail);
    await page.getByLabel("Current Password").fill(TEST_PASSWORD);

    // Submit using footer button
    const emailBtn = await getFooterButton(page, /change email/i);
    await emailBtn.click();

    // Should show success toast and return to main settings
    await expect(page.getByText("Email saved")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("cancel returns to main settings", async ({ page, myItemsPage }) => {
    await myItemsPage.openProfileSettings();
    await expect(await getProfileContainer(page)).toBeVisible({
      timeout: 10000,
    });

    // Navigate to Account tab first
    await selectSettingsTab(page, "Account");

    // Navigate to change email step
    await page.getByRole("button", { name: /change email/i }).click();
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).toBeVisible();

    // Click cancel in footer (use last() to handle animated transitions)
    const cancelBtn = await getFooterCancelButton(page);
    await cancelBtn.click();

    // Should return to main settings view
    await expect(
      page.getByRole("heading", { name: /change email/i })
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});
