/**
 * Page object for public profile and item pages.
 * Provides helpers for viewing public profiles and forking items.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class PublicProfilePage {
  readonly page: Page;
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly heroDescription: Locator;
  readonly itemsGrid: Locator;
  readonly emptyState: Locator;
  readonly forkButton: Locator;
  readonly forkInLibraryButton: Locator;
  readonly forkDestinationDialog: Locator;
  readonly forkDialogConfirm: Locator;
  readonly forkCount: Locator;
  readonly breadcrumb: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroSection = page.getByTestId("item-hero");
    this.heroTitle = this.heroSection.locator("h1");
    this.heroDescription = this.heroSection.locator("p").first();
    this.itemsGrid = page.getByTestId("items-grid-view");
    this.emptyState = page.getByText(/no public items yet|no child items/i);
    this.forkButton = page.getByRole("button", { name: /fork to library/i });
    this.forkInLibraryButton = page.getByRole("link", {
      name: /in your library/i,
    });
    this.forkDestinationDialog = page.getByRole("dialog", {
      name: /fork to library/i,
    });
    this.forkDialogConfirm = page.getByRole("button", { name: /fork here/i });
    this.forkCount = page.getByText(/\d+ forks?/);
    this.breadcrumb = page.getByLabel("Breadcrumb");
  }

  /** Navigate to a public profile */
  async gotoProfile(username: string) {
    await this.page.goto(`/u/${username}`);
  }

  /** Navigate to a public item */
  async gotoItem(username: string, itemId: string) {
    await this.page.goto(`/u/${username}/${itemId}`);
  }

  /** Navigate to explore page */
  async gotoExplore() {
    await this.page.goto("/explore");
  }

  /** Expect hero section to be visible with title */
  async expectHeroVisible(title: string) {
    await expect(this.heroSection).toBeVisible();
    await expect(this.heroTitle).toContainText(title);
  }

  /** Expect public profile to show username */
  async expectProfileUsername(username: string) {
    await expect(this.heroDescription).toContainText(`@${username}`);
  }

  /** Expect items grid to contain an item */
  async expectItemVisible(name: string) {
    await expect(this.itemsGrid.getByText(name)).toBeVisible();
  }

  /** Expect empty state message */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /** Click on an item in the grid */
  async clickItem(name: string) {
    await this.itemsGrid.getByText(name).click();
  }

  /** Fork an item to root */
  async forkItem() {
    await this.forkButton.click();
    await expect(this.forkDestinationDialog).toBeVisible();
    await this.forkDialogConfirm.click();
  }

  /** Expect fork button to show "In Your Library" */
  async expectAlreadyForked() {
    await expect(this.forkInLibraryButton).toBeVisible();
  }

  /** Expect fork button available for authenticated user */
  async expectForkButtonVisible() {
    await expect(this.forkButton).toBeVisible();
  }

  /** Expect sign-in prompt for unauthenticated user */
  async expectSignInToFork() {
    await expect(
      this.page.getByRole("link", { name: /sign in to fork/i })
    ).toBeVisible();
  }

  /** Expect success toast */
  async expectSuccessToast(message: string | RegExp) {
    const toast = this.page.locator('[data-sonner-toast][data-type="success"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText(message);
  }

  /** Wait for toast to disappear */
  async waitForToastToDisappear() {
    await this.page
      .locator('[data-sonner-toast][data-type="success"]')
      .waitFor({ state: "hidden", timeout: 6000 });
  }

  /** Navigate via breadcrumb back arrow */
  async clickBreadcrumbBack() {
    await this.breadcrumb.getByRole("link").first().click();
  }
}
