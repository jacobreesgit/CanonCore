/**
 * E2E tests for changing password via settings.
 * Verifies the password change flow on the account tab.
 */
import { test, expect } from "../../fixtures";

test.describe("Password Change", () => {
  test("should change password via account settings", async ({
    testUser,
    settings,
    nav,
  }) => {
    await nav.gotoMyItems();

    // Open settings and switch to account tab
    await settings.open();
    await settings.switchToTab("account");

    // Navigate to the password change step
    await settings.openPasswordChangeStep();

    // Fill in password change form
    await settings.fillCurrentPassword(testUser.password);
    await settings.fillNewPassword("NewPassword123");
    await settings.fillConfirmPassword("NewPassword123");
    await settings.submitPasswordChange();

    // Verify success
    await settings.expectPasswordChangeSuccess();
  });
});
