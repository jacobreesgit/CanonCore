/**
 * Page object for public profile and item pages.
 * Provides helpers for viewing public profiles, forking items,
 * and testing view toggle and hero collapse functionality.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class PublicProfilePage {
  readonly page: Page;
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly heroDescription: Locator;
  readonly profileHeroSection: Locator;
  readonly profileHeroTitle: Locator;
  readonly itemsGrid: Locator;
  readonly itemsTree: Locator;
  readonly emptyState: Locator;
  readonly forkButton: Locator;
  readonly forkInLibraryButton: Locator;
  readonly forkDestinationDialog: Locator;
  readonly forkDialogConfirm: Locator;
  readonly forkCount: Locator;
  readonly breadcrumb: Locator;
  readonly viewToggleTree: Locator;
  readonly viewToggleGrid: Locator;
  readonly heroForkButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Item detail hero (hero-carousel)
    this.heroSection = page.getByTestId("hero-carousel");
    this.heroTitle = this.heroSection.locator("h1");
    this.heroDescription = this.heroSection.locator("p").first();
    // Profile hero (profile-hero)
    this.profileHeroSection = page.getByTestId("profile-hero");
    this.profileHeroTitle = this.profileHeroSection.locator("h1");
    this.itemsGrid = page.getByTestId("items-grid-view");
    this.itemsTree = page.getByTestId("items-tree-view");
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
    // There are two breadcrumbs: header (Home) and content (username > item)
    // The content breadcrumb is the second/last one
    this.breadcrumb = page.getByLabel("Breadcrumb").last();
    // View toggle buttons
    this.viewToggleTree = page.getByRole("button", { name: /tree view/i });
    this.viewToggleGrid = page.getByRole("button", { name: /grid view/i });
    // Hero carousel fork button (different from toolbar fork button)
    this.heroForkButton = page.getByTestId("hero-fork-button");
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

  /** Expect item hero section (hero-carousel) to be visible with title */
  async expectHeroVisible(title: string) {
    await expect(this.heroSection).toBeVisible();
    await expect(this.heroTitle).toContainText(title);
  }

  /** Expect profile hero section (profile-hero) to be visible with username */
  async expectProfileHeroVisible(username: string) {
    await expect(this.profileHeroSection).toBeVisible();
    await expect(this.profileHeroTitle).toContainText(`@${username}`);
  }

  /** Expect public profile to show username */
  async expectProfileUsername(username: string) {
    await expect(this.heroDescription).toContainText(`@${username}`);
  }

  /** Expect items grid to contain an item */
  async expectItemVisible(name: string) {
    // Use first() since grid items have name in both title and description
    await expect(this.itemsGrid.getByText(name).first()).toBeVisible();
  }

  /** Expect empty state message */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /** Click on an item in the grid */
  async clickItem(name: string) {
    // Use first() since grid items have name in both title and description
    await this.itemsGrid.getByText(name).first().click();
  }

  /** Fork an item to root */
  async forkItem() {
    // Fork happens directly without dialog in current implementation
    await this.forkButton.click();
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
    // Use first() since there may be multiple "Sign in to Fork" links (hero + toolbar)
    await expect(
      this.page.getByRole("link", { name: /sign in to fork/i }).first()
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

  /** Switch to tree view */
  async switchToTreeView() {
    await this.viewToggleTree.click();
  }

  /** Switch to grid view */
  async switchToGridView() {
    await this.viewToggleGrid.click();
  }

  /** Expect tree view to be visible */
  async expectTreeViewVisible() {
    await expect(this.itemsTree).toBeVisible();
  }

  /** Expect grid view to be visible */
  async expectGridViewVisible() {
    await expect(this.itemsGrid).toBeVisible();
  }

  /** Expect an item in tree view by name */
  async expectItemInTree(name: string) {
    await expect(
      this.itemsTree.getByRole("listitem").filter({ hasText: name })
    ).toBeVisible();
  }

  /** Expect hero carousel to show "Sign in to Fork" button (guest user) */
  async expectHeroSignInToFork() {
    await expect(this.heroForkButton).toBeVisible();
    await expect(this.heroForkButton).toContainText(/sign in to fork/i);
  }

  /** Expect hero carousel to show "In Library" button (already forked) */
  async expectHeroInLibrary() {
    await expect(this.heroForkButton).toBeVisible();
    await expect(this.heroForkButton).toContainText(/in library/i);
  }

  /** Expect hero carousel to show enabled "Fork" button (authenticated, not forked) */
  async expectHeroForkButton() {
    await expect(this.heroForkButton).toBeVisible();
    await expect(this.heroForkButton).toBeEnabled();
    await expect(this.heroForkButton).toContainText(/^fork$/i);
  }
}
