/**
 * Page object for item sorting, filtering, and view mode switching.
 * Covers desktop dropdowns and mobile bottom sheets for sort, filter, and view controls.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class ItemsSortFilterPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Navigation ─────────────────────────────────────────

  /** Navigate to the user's items page. */
  async goto() {
    await this.page.goto(`/u/${this.username}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  // ── Sort ───────────────────────────────────────────────

  /**
   * Select a sort option.
   * Desktop: clicks the sort dropdown trigger, then the sort-option-{value} radio item.
   * Mobile: opens the options sheet and selects the sort radio option by label.
   *
   * @param value - The sort option value (e.g., "custom", "name-asc", "name-desc", "newest", "oldest", "updated")
   */
  async selectSort(value: string) {
    if (this.isMobile) {
      await this.openMobileOptionsSheet();
      // Find the sort radio button matching this value's label and click it
      const sortRadio = this.page.getByRole("radio", {
        name: new RegExp(this.sortValueToLabel(value), "i"),
      });
      await sortRadio.waitFor({
        state: "visible",
        timeout: Timeouts.animation,
      });
      await sortRadio.click();
    } else {
      await this.page.getByTestId("items-sort-dropdown").click();
      await this.page.getByTestId(`sort-option-${value}`).click();
    }
  }

  /**
   * Verify that a sort option is currently active.
   * Desktop: checks the sort dropdown trigger contains the expected label.
   * Mobile: opens the options sheet and checks the radio is checked.
   *
   * @param value - The sort option value to verify
   */
  async expectSortActive(value: string) {
    if (this.isMobile) {
      await this.openMobileOptionsSheet();
      const sortRadio = this.page.getByRole("radio", {
        name: new RegExp(this.sortValueToLabel(value), "i"),
      });
      await expect(sortRadio).toHaveAttribute("aria-checked", "true", {
        timeout: Timeouts.animation,
      });
      // Close the sheet after checking
      await this.closeMobileSheet();
    } else {
      const trigger = this.page.getByTestId("items-sort-dropdown");
      await expect(trigger).toContainText(this.sortValueToLabel(value), {
        timeout: Timeouts.animation,
      });
    }
  }

  // ── Filter ─────────────────────────────────────────────

  /**
   * Toggle a filter checkbox on or off.
   * Desktop: opens the filter dropdown and clicks the checkbox item by label.
   * Mobile: opens the options sheet and toggles the checkbox.
   *
   * @param label - The visible filter label (e.g., "Has Files", "No Files", "Synced", "Pending", "Error")
   */
  async toggleFilter(label: string) {
    if (this.isMobile) {
      await this.openMobileOptionsSheet();
      const checkbox = this.page.getByRole("checkbox", { name: label });
      await checkbox.waitFor({ state: "visible", timeout: Timeouts.animation });
      await checkbox.click();
    } else {
      await this.page.getByTestId("items-filter-dropdown").click();
      // DropdownMenuCheckboxItem renders as menuitemcheckbox role
      const checkbox = this.page.getByRole("menuitemcheckbox", { name: label });
      await checkbox.waitFor({ state: "visible", timeout: Timeouts.animation });
      await checkbox.click();
    }
  }

  /**
   * Clear all active filters.
   * Desktop: clicks the clear button inside the filter dropdown.
   * Mobile: opens the options sheet and clicks the "Clear all" button.
   */
  async clearFilters() {
    if (this.isMobile) {
      await this.openMobileOptionsSheet();
      const clearButton = this.page.getByRole("button", { name: /clear all/i });
      await clearButton.waitFor({
        state: "visible",
        timeout: Timeouts.animation,
      });
      await clearButton.click();
    } else {
      // Ensure filter dropdown is open first
      const filterTrigger = this.page.getByTestId("items-filter-dropdown");
      await filterTrigger.click();
      await this.page.getByTestId("items-filter-clear").click();
    }
  }

  // ── View Mode ──────────────────────────────────────────

  /**
   * Switch to grid view mode.
   * Desktop: clicks the view dropdown and selects Grid.
   * Mobile: opens the options sheet and selects the Grid option.
   */
  async switchToGrid() {
    if (this.isMobile) {
      await this.openMobileOptionsSheet();
      await this.page.getByRole("option", { name: /grid/i }).click();
    } else {
      // Open view dropdown by aria-label (matches "View mode: Grid" or "View mode: Tree")
      await this.page
        .getByRole("button", { name: /view mode: (grid|tree)/i })
        .first()
        .click();
      await this.page.getByRole("menuitemradio", { name: /grid/i }).click();
    }
  }

  /**
   * Switch to tree view mode.
   * Desktop: clicks the view dropdown and selects Tree.
   * Mobile: opens the options sheet and selects the Tree option.
   */
  async switchToTree() {
    if (this.isMobile) {
      await this.openMobileOptionsSheet();
      await this.page.getByRole("option", { name: /tree/i }).click();
    } else {
      await this.page
        .getByRole("button", { name: /view mode: (grid|tree)/i })
        .first()
        .click();
      await this.page.getByRole("menuitemradio", { name: /tree/i }).click();
    }
  }

  // ── Mobile Sheet Helpers ───────────────────────────────

  /**
   * Open the mobile options bottom sheet.
   * Handles both sheet-mobile-options (standalone) and sheet-item-options (combined) variants.
   */
  private async openMobileOptionsSheet() {
    // Check if either sheet is already visible
    const mobileOptions = this.page.getByTestId("sheet-mobile-options");
    const itemOptions = this.page.getByTestId("sheet-item-options");
    const isAlreadyOpen =
      (await mobileOptions.isVisible().catch(() => false)) ||
      (await itemOptions.isVisible().catch(() => false));

    if (isAlreadyOpen) return;

    // Click the "Options" trigger button (exact match to avoid "More options" buttons)
    const optionsTrigger = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });
    await optionsTrigger.waitFor({
      state: "visible",
      timeout: Timeouts.navigation,
    });
    await optionsTrigger.click();

    // Wait for either sheet to appear
    await expect(mobileOptions.or(itemOptions)).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /**
   * Close any open mobile bottom sheet by pressing Escape.
   */
  private async closeMobileSheet() {
    await this.page.keyboard.press("Escape");
    // Wait for both sheet variants to be hidden
    const mobileOptions = this.page.getByTestId("sheet-mobile-options");
    const itemOptions = this.page.getByTestId("sheet-item-options");
    await expect(mobileOptions.or(itemOptions)).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  // ── Private Helpers ────────────────────────────────────

  /**
   * Map sort option value to its user-facing label.
   *
   * @param value - Sort option value
   * @returns Human-readable label
   */
  private sortValueToLabel(value: string): string {
    const labels: Record<string, string> = {
      custom: "Custom Order",
      "name-asc": "Name A-Z",
      "name-desc": "Name Z-A",
      newest: "Newest",
      oldest: "Oldest",
      updated: "Recently Updated",
    };
    return labels[value] ?? value;
  }
}
