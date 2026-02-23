/**
 * E2E tests for account deletion and data export.
 * Uses existing fixtures: settings (SettingsPage POM), testUser (TestUserInfo).
 */
import { test, expect } from "../fixtures";

test.describe("Account Deletion", () => {
  test("should show delete account step with confirmation", async ({
    itemsCrud,
    settings,
    page,
  }) => {
    await itemsCrud.goto();
    await settings.open();
    await settings.switchToTab("account");

    // Click Delete Account button
    await page.getByRole("button", { name: "Delete Account" }).click();

    // Verify delete step is shown
    await expect(
      page.getByRole("heading", { name: "Delete Account" })
    ).toBeVisible();
    await expect(page.getByText("This action is permanent")).toBeVisible();

    // Delete button should be disabled without inputs
    const deleteButton = page.getByRole("button", {
      name: "Delete My Account",
    });
    await expect(deleteButton).toBeDisabled();
  });

  test("should reject wrong password", async ({
    itemsCrud,
    settings,
    page,
  }) => {
    await itemsCrud.goto();
    await settings.open();
    await settings.switchToTab("account");
    await page.getByRole("button", { name: "Delete Account" }).click();

    // Use id selector — getByLabel("Password") matches both input and "Show password" button
    await page.locator("#delete-password").fill("WrongPassword1");
    // Use id selector for the confirm field — the label contains a <span> which
    // can make getByLabel with regex fragile
    await page.locator("#delete-confirm").fill("DELETE");
    await page.getByRole("button", { name: "Delete My Account" }).click();

    await expect(page.getByText("Incorrect password")).toBeVisible();
  });

  test("should delete account and redirect to homepage", async ({
    testUser,
    itemsCrud,
    settings,
    page,
  }) => {
    await itemsCrud.goto();
    await settings.open();
    await settings.switchToTab("account");
    await page.getByRole("button", { name: "Delete Account" }).click();

    await page.locator("#delete-password").fill(testUser.password);
    await page.locator("#delete-confirm").fill("DELETE");
    await page.getByRole("button", { name: "Delete My Account" }).click();

    // Should redirect to homepage after signOut
    await page.waitForURL("/", { timeout: 10000 });
  });
});

test.describe("Data Export", () => {
  test("should export data successfully", async ({
    itemsCrud,
    settings,
    page,
  }) => {
    await itemsCrud.goto();
    await settings.open();
    await settings.switchToTab("account");

    await page.getByRole("button", { name: "Download My Data" }).click();

    // Verify loading state appears
    await expect(page.getByText("Preparing…")).toBeVisible();

    // Verify success toast
    await expect(page.getByText("Data exported successfully")).toBeVisible({
      timeout: 10000,
    });
  });
});
