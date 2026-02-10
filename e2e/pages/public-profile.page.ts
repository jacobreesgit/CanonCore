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
  readonly sortDropdown: Locator;
  readonly filterDropdown: Locator;
  readonly pinnedSection: Locator;
  readonly librarySection: Locator;
  readonly heroProgressBar: Locator;
  readonly heroProgressLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    // Item detail hero (hero-carousel)
    this.heroSection = page.getByTestId("hero-carousel");
    this.heroTitle = this.heroSection.locator("h1");
    this.heroDescription = this.heroSection.locator("p").first();
    // Profile hero (now uses hero-carousel testid via CinematicHero)
    this.profileHeroSection = page.getByTestId("hero-carousel");
    this.profileHeroTitle = this.profileHeroSection.locator("h1");
    this.itemsGrid = page.getByTestId("items-grid-view");
    this.itemsTree = page.getByTestId("items-tree-view");
    this.emptyState = page.getByText(/no public items yet|no child items/i);
    this.forkButton = page.getByRole("button", { name: /fork to library/i });
    this.forkInLibraryButton = page.getByRole("button", {
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
    // View toggle: desktop uses ViewDropdown trigger, mobile uses MobileOptionsSheet
    this.viewToggleTree = page.getByRole("button", { name: /tree view/i });
    this.viewToggleGrid = page.getByRole("button", { name: /grid view/i });
    // Hero carousel fork button (different from toolbar fork button)
    this.heroForkButton = page.getByTestId("hero-fork-button");
    // Sort and filter dropdowns (used by ContentToolbar on viewer profiles and explore)
    this.sortDropdown = page
      .getByRole("button", {
        name: /recently updated|name a-z|name z-a/i,
      })
      .first();
    this.filterDropdown = page
      .getByRole("button", {
        name: /all items|exclude yours|has files|no files|synced|pending sync|sync error/i,
      })
      .first();
    // Profile sections
    this.pinnedSection = page.getByLabel("Pinned items");
    this.librarySection = page.getByLabel("Library");
    // Hero progress
    this.heroProgressBar = page.getByTestId("hero-progress-bar");
    this.heroProgressLabel = page.getByTestId("hero-progress-label");
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

  /** Expect profile hero section to be visible with username */
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
    await expect(
      this.itemsGrid
        .locator('[data-testid="grid-item-title"]')
        .filter({ hasText: name })
    ).toBeVisible();
  }

  /** Expect empty state message */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /** Click on an item in the grid */
  async clickItem(name: string) {
    // Use dispatchEvent to avoid hover triggering the overlay which contains
    // an owner profile link that intercepts regular clicks
    await this.itemsGrid
      .locator("[data-id]")
      .filter({ hasText: name })
      .first()
      .dispatchEvent("click");
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
    // HeroButton renders <button>, not <a>, so use button role
    await expect(
      this.page.getByRole("button", { name: /sign in to fork/i }).first()
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

  /** Switch to tree view. Handles desktop ViewDropdown and mobile MobileOptionsSheet. */
  async switchToTreeView() {
    await this.selectViewOption("Tree");
  }

  /** Switch to grid view. Handles desktop ViewDropdown and mobile MobileOptionsSheet. */
  async switchToGridView() {
    await this.selectViewOption("Grid");
  }

  /** Select a view option (Grid or Tree). Handles both desktop and mobile. */
  private async selectViewOption(label: string) {
    const mobileOptionsButton = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });

    // Desktop: ViewDropdown trigger shows current view name (Grid/Tree)
    const viewDropdown = this.page
      .getByRole("button", { name: /^(Grid|Tree)$/i })
      .first();

    await expect(mobileOptionsButton.or(viewDropdown).first()).toBeVisible({
      timeout: 10000,
    });

    const isMobile = await mobileOptionsButton.isVisible();

    if (isMobile) {
      await mobileOptionsButton.click();
      await expect(
        this.page.getByRole("dialog", { name: /view options/i })
      ).toBeVisible();
      const option = this.page.getByRole("option", {
        name: new RegExp(label, "i"),
      });
      await option.click();
      await expect(option).toHaveAttribute("aria-selected", "true");
      await this.closeMobileOptionsSheet();
    } else {
      await viewDropdown.click();
      await this.page
        .getByRole("menuitemradio", { name: new RegExp(label, "i") })
        .click();
    }
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
    await expect(this.heroForkButton).toContainText(/in.*library/i);
  }

  /** Expect hero carousel to show enabled "Fork" button (authenticated, not forked) */
  async expectHeroForkButton() {
    await expect(this.heroForkButton).toBeVisible();
    await expect(this.heroForkButton).toBeEnabled();
    await expect(this.heroForkButton).toContainText(/fork to library/i);
  }

  /** Select a sort option. Handles both desktop dropdown and mobile Options sheet. */
  async selectSortOption(label: string) {
    const mobileOptionsButton = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });

    await expect(mobileOptionsButton.or(this.sortDropdown).first()).toBeVisible(
      { timeout: 10000 }
    );

    const isMobile = await mobileOptionsButton.isVisible();

    if (isMobile) {
      await mobileOptionsButton.click();
      await expect(
        this.page.getByRole("dialog", { name: /view options/i })
      ).toBeVisible();
      const option = this.page.getByRole("option", {
        name: new RegExp(label, "i"),
      });
      await option.click();
      await expect(option).toHaveAttribute("aria-selected", "true");
      await this.closeMobileOptionsSheet();
    } else {
      await this.sortDropdown.click();
      await this.page
        .getByRole("menuitemradio", { name: new RegExp(label, "i") })
        .click();
    }
  }

  /** Select a filter option. Handles both desktop dropdown and mobile Options sheet. */
  async selectFilterOption(label: string) {
    const mobileOptionsButton = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });

    await expect(
      mobileOptionsButton.or(this.filterDropdown).first()
    ).toBeVisible({ timeout: 10000 });

    const isMobile = await mobileOptionsButton.isVisible();

    if (isMobile) {
      await mobileOptionsButton.click();
      await expect(
        this.page.getByRole("dialog", { name: /view options/i })
      ).toBeVisible();
      const option = this.page.getByRole("option", {
        name: new RegExp(label, "i"),
      });
      await option.click();
      await expect(option).toHaveAttribute("aria-selected", "true");
      await this.closeMobileOptionsSheet();
    } else {
      await this.filterDropdown.click();
      await this.page
        .getByRole("menuitemradio", { name: new RegExp(label, "i") })
        .click();
    }
  }

  /** Close the MobileOptionsSheet by clicking the Vaul overlay. */
  private async closeMobileOptionsSheet() {
    const overlay = this.page.locator("[data-vaul-overlay]");
    await overlay.click({ force: true, position: { x: 10, y: 10 } });
    await expect(
      this.page.getByRole("dialog", { name: /view options/i })
    ).not.toBeVisible({ timeout: 5000 });
  }

  /** Expect pinned section to be visible */
  async expectPinnedSectionVisible() {
    await expect(this.pinnedSection).toBeVisible();
  }

  /** Expect hero progress bar to be visible */
  async expectHeroProgressVisible() {
    await expect(this.heroProgressBar).toBeVisible();
  }
}
