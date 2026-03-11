/**
 * E2E tests for the landing page.
 * Covers hero section, feature accordion, manifesto CTA, and footer links.
 */
import { publicTest, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

publicTest.describe("Landing Page", () => {
  publicTest.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  publicTest("should display hero heading and subheading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Your media library. Elevated." })
    ).toBeVisible();

    await expect(
      page.getByText("Organise, stream, and share your personal media")
    ).toBeVisible();
  });

  publicTest(
    "should have hero CTAs linking to sign-up and explore",
    async ({ page }) => {
      const main = page.locator("#main-content");

      const getStarted = main
        .getByRole("link", { name: /get started/i })
        .first();
      const explore = main
        .getByRole("link", { name: /explore collections/i })
        .first();

      await expect(getStarted).toBeVisible();
      await expect(getStarted).toHaveAttribute("href", "/sign-up");

      await expect(explore).toBeVisible();
      await expect(explore).toHaveAttribute("href", "/explore");
    }
  );

  publicTest("should display feature accordion section", async ({ page }) => {
    // Scroll past hero to trigger whileInView animations (margin: -100px)
    const heading = page.getByRole("heading", {
      name: "Your complete media command centre.",
    });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible({ timeout: Timeouts.navigation });

    await expect(
      page.getByRole("button", { name: "Google Drive Native" })
    ).toBeVisible();
  });

  publicTest("should display manifesto section", async ({ page }) => {
    const heading = page.getByRole("heading", {
      name: "Your files. Your library. Your rules.",
    });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
  });

  publicTest("should have footer legal links", async ({ page }) => {
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();

    await expect(
      footer.getByRole("link", { name: "Privacy Policy" })
    ).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Terms of Service" })
    ).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Cookie Policy" })
    ).toBeVisible();
  });
});
