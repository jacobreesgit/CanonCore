/**
 * E2E tests for Google Drive OAuth connection management.
 * Tests connect, disconnect, and error states.
 */

import { test, expect, prisma } from "../../fixtures";
import { SettingsPage } from "../../pages/settings.page";
import { encryptCredential } from "@/lib/crypto";

test.describe("Google Drive: OAuth Connection", () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await page.goto("/my-items");
  });

  test("shows Connect button when not connected", async ({
    page,
    testUser,
  }) => {
    // Ensure no connection exists
    await prisma.googleDriveConnection.deleteMany({
      where: { userId: testUser.id },
    });

    await page.reload();
    await settingsPage.openFromNavUser();

    // Should show connect button
    await expect(
      page.getByRole("button", { name: /connect google drive/i })
    ).toBeVisible();

    // Should NOT show connected badge
    await expect(page.getByText(/connected/i)).not.toBeVisible();
  });

  test("shows connected state when connection exists", async ({
    page,
    setupDriveConnection,
    testUser,
  }) => {
    await setupDriveConnection(testUser.id);
    await page.reload();

    await settingsPage.openFromNavUser();

    // Should show connected badge
    await expect(page.getByText("Connected")).toBeVisible();

    // Should NOT show connect button
    await expect(
      page.getByRole("button", { name: /connect google drive/i })
    ).not.toBeVisible();
  });

  test("disconnect removes connection", async ({
    page,
    setupDriveConnection,
    testUser,
  }) => {
    await setupDriveConnection(testUser.id);
    await page.reload();

    await settingsPage.openFromNavUser();

    // Click disconnect (trash icon)
    await settingsPage.clickDisconnect();

    // Confirm in dialog
    await settingsPage.confirmDisconnect();

    // Wait for page to update
    await page.waitForLoadState("networkidle");

    // Should show connect button again
    await expect(
      page.getByRole("button", { name: /connect google drive/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows reconnect badge when token expired", async ({
    page,
    testUser,
  }) => {
    // Create connection with expired token
    await prisma.googleDriveConnection.upsert({
      where: { userId: testUser.id },
      update: {
        accessTokenExpiry: new Date(0),
        needsReauth: true,
        isActive: false,
      },
      create: {
        userId: testUser.id,
        name: "Test Google Drive",
        email: "test@example.com",
        encryptedAccessToken: encryptCredential("expired-token"),
        encryptedRefreshToken: encryptCredential("expired-refresh"),
        accessTokenExpiry: new Date(0),
        rootFolderId: "test-root-folder-id",
        needsReauth: true,
        isActive: false,
      },
    });

    await page.reload();
    await settingsPage.openFromNavUser();

    // Should show reconnect badge (using locator for the badge specifically)
    await expect(
      page.locator('[data-slot="badge"]').filter({ hasText: /reconnect/i })
    ).toBeVisible();
  });

  test("rejects invalid OAuth callback", async ({ request }) => {
    // Try to complete OAuth with a tampered state
    const response = await request.get(
      "/api/auth/callback/google-drive?code=test&state=tampered",
      {
        maxRedirects: 0,
      }
    );

    // Should return error status or redirect to error
    const status = response.status();
    expect([400, 401, 302, 307]).toContain(status);
  });
});
