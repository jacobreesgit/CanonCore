/**
 * E2E tests for account lockout after repeated failed sign-in attempts.
 * Verifies that accounts are temporarily locked after 5 failed attempts.
 */
import { publicTest, expect } from "../../fixtures";
import { prisma } from "../../fixtures/authenticated.fixture";
import { testEmail, TEST_PASSWORD } from "../../config/test-data";
import { hash } from "bcryptjs";

publicTest.describe("Account Lockout", () => {
  let lockoutUserId: string;
  let lockoutEmail: string;

  publicTest.beforeEach(async () => {
    lockoutEmail = testEmail("lockout");
    const passwordHash = await hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: { email: lockoutEmail, passwordHash },
    });
    lockoutUserId = user.id;
  });

  publicTest.afterEach(async () => {
    if (lockoutUserId) {
      await prisma.user
        .delete({ where: { id: lockoutUserId } })
        .catch(() => {});
    }
  });

  publicTest(
    "shows lockout message after 5 failed attempts",
    async ({ auth }) => {
      await auth.gotoSignIn();

      // Attempts 1-4: wrong password, expect generic error
      for (let i = 0; i < 4; i++) {
        await auth.signIn(lockoutEmail, "WrongPassword1");
        await auth.expectSignInError("Invalid email or password");
      }

      // Attempt 5: triggers lockout — expect lockout message
      await auth.signIn(lockoutEmail, "WrongPassword1");
      await auth.expectSignInError("Account temporarily locked");
    }
  );
});
