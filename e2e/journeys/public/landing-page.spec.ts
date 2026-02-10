/**
 * E2E tests for the public landing page.
 * Tests hero rendering, CTAs, feature grid, and navigation links.
 */

import { test, expect } from "../../fixtures";

test.describe("Landing Page", () => {
  test("renders hero with title and CTAs", async ({ page, landingPage }) => {
    await landingPage.goto();
    await landingPage.expectVisible();

    const main = page.locator("#main-content");

    // Hero title should be visible
    await expect(page.getByTestId("landing-hero-title")).toBeVisible();
    await expect(page.getByTestId("landing-hero-title")).toContainText(
      "Your media library"
    );

    // CTA buttons in main content (sidebar also has "Get Started")
    await expect(
      main.getByRole("link", { name: /get started/i })
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: /explore collections/i })
    ).toBeVisible();
  });

  test("shows feature grid section", async ({ page, landingPage }) => {
    await landingPage.goto();
    await landingPage.expectVisible();

    // Feature section heading
    await expect(
      page.getByRole("heading", { name: /features that speak for/i })
    ).toBeVisible();

    // Spot-check a few feature cards
    await expect(page.getByText("Infinite Hierarchy")).toBeVisible();
    await expect(page.getByText("Drive Sync")).toBeVisible();
    await expect(page.getByText("Rich Metadata")).toBeVisible();
  });

  test("Get Started CTA navigates to sign-up", async ({
    page,
    landingPage,
  }) => {
    await landingPage.goto();
    await landingPage.expectVisible();

    // Scope to main content to avoid sidebar "Get Started" link
    await page
      .locator("#main-content")
      .getByRole("link", { name: /get started/i })
      .click();
    await expect(page).toHaveURL(/\/sign-up/, { timeout: 10000 });
  });

  test("Explore Collections CTA navigates to explore", async ({
    page,
    landingPage,
  }) => {
    await landingPage.goto();
    await landingPage.expectVisible();

    await page.getByRole("link", { name: /explore collections/i }).click();
    await expect(page).toHaveURL(/\/explore/, { timeout: 10000 });
  });
});
