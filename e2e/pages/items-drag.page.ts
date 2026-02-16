/**
 * Page object for drag-and-drop and bulk operations.
 * Covers entering/exiting edit mode, dragging items to reorder,
 * selecting items for bulk actions, and verifying item order.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";
import { slugify } from "../../lib/slugify";

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
    const fromSlug = slugify(fromName);
    const toSlug = slugify(toName);

    const fromTree = this.page.getByTestId(`item-tree-${fromSlug}`);
    const toTree = this.page.getByTestId(`item-tree-${toSlug}`);

    // Try tree items first, fall back to card items
    const fromLocator = (await fromTree.isVisible())
      ? fromTree
      : this.page.getByTestId(`item-card-${fromSlug}`);
    const toLocator = (await toTree.isVisible())
      ? toTree
      : this.page.getByTestId(`item-card-${toSlug}`);

    await fromLocator.dragTo(toLocator);
  }

  // ── Bulk Selection ───────────────────────────────────────

  /** Select an item by clicking its checkbox in edit mode. */
  async selectItem(name: string) {
    const slug = slugify(name);
    const treeItem = this.page.getByTestId(`item-tree-${slug}`);
    const cardItem = this.page.getByTestId(`item-card-${slug}`);

    // Click the item itself -- in edit mode, clicking toggles selection
    const item = (await treeItem.isVisible()) ? treeItem : cardItem;
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
    for (let i = 0; i < names.length; i++) {
      const slug = slugify(names[i]);
      const treeItem = this.page.getByTestId(`item-tree-${slug}`);
      const cardItem = this.page.getByTestId(`item-card-${slug}`);

      // Verify each item is visible in either view
      const item = (await treeItem.isVisible()) ? treeItem : cardItem;
      await expect(item).toBeVisible({ timeout: Timeouts.api });
    }

    // Verify ordering by checking that each item appears before the next
    for (let i = 0; i < names.length - 1; i++) {
      const currentSlug = slugify(names[i]);
      const nextSlug = slugify(names[i + 1]);

      const currentTree = this.page.getByTestId(`item-tree-${currentSlug}`);
      const currentItem = (await currentTree.isVisible())
        ? currentTree
        : this.page.getByTestId(`item-card-${currentSlug}`);

      const nextTree = this.page.getByTestId(`item-tree-${nextSlug}`);
      const nextItem = (await nextTree.isVisible())
        ? nextTree
        : this.page.getByTestId(`item-card-${nextSlug}`);

      // Use evaluate to check DOM order
      const isBeforeInDom = await this.page.evaluate(
        ([currentTestId, nextTestId]) => {
          const current = document.querySelector(
            `[data-testid="${currentTestId}"]`
          );
          const next = document.querySelector(`[data-testid="${nextTestId}"]`);
          if (!current || !next) return false;
          const position = current.compareDocumentPosition(next);
          // Node.DOCUMENT_POSITION_FOLLOWING = 4
          return (position & 4) !== 0;
        },
        [
          (await currentTree.isVisible())
            ? `item-tree-${currentSlug}`
            : `item-card-${currentSlug}`,
          (await nextTree.isVisible())
            ? `item-tree-${nextSlug}`
            : `item-card-${nextSlug}`,
        ]
      );

      expect(isBeforeInDom).toBe(true);
    }
  }
}
