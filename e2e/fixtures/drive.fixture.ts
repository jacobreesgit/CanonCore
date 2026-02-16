/**
 * Google Drive test fixture.
 * Extends authenticated fixture with Drive connection setup/cleanup.
 */
import { authenticatedFixture, prisma } from "./authenticated.fixture";
import { Timeouts } from "../config/timeouts";
import { E2E_DRIVE_USER } from "../config/test-data";

// Re-export for Drive tests that need DB access
export { prisma };

export interface E2eDriveUser {
  id: string;
  email: string;
  password: string;
  username: string;
}

export const driveFixture = authenticatedFixture.extend<{
  e2eDriveUser: E2eDriveUser;
}>({
  e2eDriveUser: async ({ page }, use) => {
    const user = await prisma.user.findUnique({
      where: { email: E2E_DRIVE_USER.email },
    });

    if (!user || !user.username) {
      throw new Error(
        `E2E Drive user not found: ${E2E_DRIVE_USER.email}\nRun: pnpm run setup:e2e-drive`
      );
    }

    const e2eDriveUser: E2eDriveUser = {
      id: user.id,
      email: E2E_DRIVE_USER.email,
      password: E2E_DRIVE_USER.password,
      username: user.username,
    };

    // Sign in the Drive user
    await page.goto("/sign-in");
    const emailInput = page.getByTestId("sign-in-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(e2eDriveUser.email);
    await page
      .getByTestId("sign-in-password-input")
      .fill(e2eDriveUser.password);
    await page.getByTestId("sign-in-submit-button").click();
    await page.waitForURL(`/u/${e2eDriveUser.username}`, {
      timeout: Timeouts.upload,
    });

    await use(e2eDriveUser);
  },
});
