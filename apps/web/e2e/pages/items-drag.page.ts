/**
 * Page object for drag-and-drop and bulk operations.
 * Covers entering/exiting edit mode, dragging items to reorder,
 * selecting items for bulk actions, and verifying item order.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";
import { getItemLocator } from "../config/item-locators";

export class ItemsDragPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Navigation ───────────────────────────────────────────

  /** Navigate to the user's items page. */
  async goto() {
    await this.page.goto(`/u/${this.username}`);
    await this.page.waitForLoadState("domcontentloaded");
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Edit Mode ────────────────────────────────────────────

  /** Enter edit mode by clicking the toggle (expects "Edit" label). */
  async enterEditMode() {
    const toggle = this.page.getByTestId("items-edit-mode-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Exit edit mode", {
      timeout: Timeouts.animation,
    });
  }

  /** Exit edit mode by clicking the toggle (expects "Done" label). */
  async exitEditMode() {
    const toggle = this.page.getByTestId("items-edit-mode-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-label", "Enter edit mode", {
      timeout: Timeouts.animation,
    });
  }

  /** Verify whether edit mode is active or inactive. */
  async expectEditMode(active: boolean) {
    const toggle = this.page.getByTestId("items-edit-mode-toggle");
    const expectedLabel = active ? "Exit edit mode" : "Enter edit mode";
    await expect(toggle).toHaveAttribute("aria-label", expectedLabel, {
      timeout: Timeouts.animation,
    });
  }

  // ── Drag and Drop ────────────────────────────────────────

  /**
   * Drag one item onto another using Playwright's drag API.
   * Uses tree item locators (item-tree-{slug}) for tree view
   * and falls back to card locators (item-card-{slug}) if tree items are not found.
   */
  async dragItem(fromName: string, toName: string) {
    const fromLocator = getItemLocator(this.page, fromName);
    const toLocator = getItemLocator(this.page, toName);
    await fromLocator.dragTo(toLocator);
  }

  // ── Bulk Selection ───────────────────────────────────────

  /** Select an item by clicking its checkbox in edit mode. */
  async selectItem(name: string) {
    const item = getItemLocator(this.page, name);
    await item.click();
  }

  /** Click the "Select All" button in the bulk actions toolbar. */
  async selectAll() {
    await this.page.getByTestId("items-bulk-select-all").click();
  }

  /** Click the "Delete" button in the bulk actions toolbar. */
  async deleteSelected() {
    await this.page.getByTestId("items-bulk-delete").click();
  }

  /** Expect the bulk actions toolbar to be visible. */
  async expectBulkToolbarVisible() {
    await expect(this.page.getByTestId("items-bulk-toolbar")).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  // ── Order Assertions ─────────────────────────────────────

  /**
   * Verify items appear in the expected order by checking DOM order.
   * Collects all matching item-tree-{slug} or item-card-{slug} elements
   * and compares their order against the provided names array.
   */
  async expectItemOrder(names: string[]) {
    // Verify each item is visible
    for (const name of names) {
      await expect(getItemLocator(this.page, name)).toBeVisible({
        timeout: Timeouts.api,
      });
    }

    // Verify ordering by checking that each item appears before the next
    for (let i = 0; i < names.length - 1; i++) {
      // Get the testid of each visible element for DOM comparison
      const currentTestId = await getItemLocator(
        this.page,
        names[i]
      ).getAttribute("data-testid");
      const nextTestId = await getItemLocator(
        this.page,
        names[i + 1]
      ).getAttribute("data-testid");

      const isBeforeInDom = await this.page.evaluate(
        ([curId, nxtId]) => {
          const current = document.querySelector(`[data-testid="${curId}"]`);
          const next = document.querySelector(`[data-testid="${nxtId}"]`);
          if (!current || !next) return false;
          const position = current.compareDocumentPosition(next);
          return (position & 4) !== 0;
        },
        [currentTestId, nextTestId]
      );

      expect(isBeforeInDom).toBe(true);
    }
  }
}
