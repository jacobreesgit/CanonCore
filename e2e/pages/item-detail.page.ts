/**
 * Page object for item detail views.
 * Covers navigation to item detail, hero section, tab switching
 * (Contents/About), about tab section filtering, and breadcrumb navigation.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class ItemDetailPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Navigation ──────────────────────────────────────────

  /**
   * Navigate to an item's detail page by clicking it on the user's profile page.
   *
   * @param itemName - The visible name of the item to click
   */
  async goto(itemName: string) {
    await this.page.goto(`/u/${this.username}`);
    const link = this.page.getByRole("link", { name: itemName });
    const button = this.page.getByRole("button", { name: itemName });
    const target = link.or(button);
    await target.waitFor({ state: "visible", timeout: Timeouts.api });
    await target.click();
    await expect(this.page.getByTestId("item-detail-container")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  /**
   * Navigate directly to an item detail page via URL.
   *
   * @param itemId - The item's unique identifier
   */
  async gotoByUrl(itemId: string) {
    await this.page.goto(`/u/${this.username}/${itemId}`);
    await expect(this.page.getByTestId("item-detail-container")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Assertions ──────────────────────────────────────────

  /** Expect the item detail container to be visible. */
  async expectDetailVisible() {
    await expect(this.page.getByTestId("item-detail-container")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  /** Expect the hero carousel section to be visible. */
  async expectHeroVisible() {
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  /** Expect the Add button to be visible (owner view). */
  async expectAddButtonVisible() {
    await expect(this.page.getByTestId("items-add-button")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /** Expect the Add button to not be visible (viewer view). */
  async expectAddButtonNotVisible() {
    await expect(this.page.getByTestId("items-add-button")).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  // ── Tab Switching ───────────────────────────────────────

  /** Switch to the About tab. */
  async switchToAboutTab() {
    await this.page.getByRole("tab", { name: "About" }).click();
    await expect(this.page.getByTestId("about-tab-content")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /** Switch to the Contents tab. */
  async switchToContentsTab() {
    await this.page.getByRole("tab", { name: "Contents" }).click();
    await expect(this.page.getByTestId("about-tab-content")).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  // ── About Tab ───────────────────────────────────────────

  /** Expect the about tab content section to be visible. */
  async expectAboutContent() {
    await expect(this.page.getByTestId("about-tab-content")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Select a filter option in the about tab's section filter dropdown.
   * Opens the dropdown and clicks the radio item matching the filter name.
   *
   * @param filterName - The label of the filter option (e.g., "Cast", "Videos", "All Sections")
   */
  async selectAboutFilter(filterName: string) {
    await this.page.getByTestId("about-section-filter").click();
    await this.page.getByRole("menuitemradio", { name: filterName }).click();
  }
}
