/**
 * Page object for the Explore page.
 * Covers navigation, sort selection, exclude-mine toggle,
 * hero carousel, and item card interactions.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class ExplorePage {
  constructor(
    private page: Page,
    private isMobile: boolean
  ) {}

  // ── Navigation ──────────────────────────────────────────

  /** Navigate to the Explore page. */
  async goto() {
    await this.page.goto("/explore", { waitUntil: "domcontentloaded" });
  }

  // ── Hero ────────────────────────────────────────────────

  /** Expect the hero carousel to be visible. */
  async expectHeroVisible() {
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Sort ────────────────────────────────────────────────

  /**
   * Select a sort option from the explore sort dropdown.
   * Desktop: clicks the dropdown trigger then selects the matching sort option.
   * Mobile: opens the options sheet and selects the sort radio option by label.
   *
   * @param value - The sort option value (e.g., "updated-desc", "name-asc")
   */
  async selectSort(value: string) {
    if (this.isMobile) {
      await this.openMobileOptionsSheet();
      const sortRadio = this.page.getByRole("radio", {
        name: new RegExp(this.sortValueToLabel(value), "i"),
      });
      await expect(sortRadio).toBeVisible({ timeout: Timeouts.api });
      await sortRadio.click();
    } else {
      const trigger = this.page.getByTestId("explore-sort-dropdown");
      await expect(trigger).toBeVisible({ timeout: Timeouts.api });
      await trigger.click();
      const option = this.page.getByTestId(`sort-option-${value}`);
      await expect(option).toBeVisible({ timeout: Timeouts.api });
      await option.click();
    }
  }

  // ── Exclude Mine ────────────────────────────────────────

  /**
   * Toggle the "Exclude Mine" button.
   * Uses getByRole instead of getByTestId because the ContentToolbar renders
   * leftActions in both mobile (lg:hidden) and desktop (hidden lg:flex) containers,
   * producing two DOM nodes with the same testid. getByRole uses the accessibility
   * tree which excludes display:none elements, resolving to the single visible button.
   */
  async toggleExcludeMine() {
    await this.page.getByRole("button", { name: "Exclude my items" }).click();
  }

  // ── Item Assertions ─────────────────────────────────────

  /**
   * Expect an item with the given name to be visible on the page.
   *
   * @param name - The item name to look for
   */
  async expectItemVisible(name: string) {
    await expect(this.page.getByRole("link", { name })).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Expect an item with the given name to not be visible on the page.
   *
   * @param name - The item name that should not appear
   */
  async expectItemNotVisible(name: string) {
    await expect(this.page.getByRole("link", { name })).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  // ── Item Interaction ────────────────────────────────────

  /**
   * Click an item card or link on the explore page.
   *
   * @param name - The name of the item to click
   */
  async clickItem(name: string) {
    await this.page.getByRole("link", { name }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  // ── Mobile Sheet Helpers ─────────────────────────────────

  /**
   * Open the mobile options bottom sheet.
   * Clicks the "Options" trigger button.
   */
  private async openMobileOptionsSheet() {
    const sheet = this.page.getByTestId("sheet-mobile-options");
    if (await sheet.isVisible().catch(() => false)) return;

    const optionsTrigger = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });
    await optionsTrigger.waitFor({
      state: "visible",
      timeout: Timeouts.navigation,
    });
    await optionsTrigger.click();
    await expect(sheet).toBeVisible({ timeout: Timeouts.animation });
  }

  // ── Private Helpers ──────────────────────────────────────

  /**
   * Map sort option value to its user-facing label.
   * Explore page has a subset of sort options.
   */
  private sortValueToLabel(value: string): string {
    const labels: Record<string, string> = {
      "updated-desc": "Recently Updated",
      "name-asc": "Name A-Z",
      "name-desc": "Name Z-A",
    };
    return labels[value] ?? value;
  }
}
