/**
 * E2E tests for Google Drive connection UI.
 * Verifies the connections tab in settings shows the Drive section.
 */
import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Drive Connection", () => {
  test("should display Drive connection status", async ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    page,
    settings,
    testUser: _testUser,
  }) => {
    await settings.open();
    await settings.expectOpen();
    await settings.switchToTab("connections");

    await expect(
      page.getByRole("button", { name: "Connect Google Drive" })
    ).toBeVisible({
      timeout: Timeouts.api,
    });
  });
});
