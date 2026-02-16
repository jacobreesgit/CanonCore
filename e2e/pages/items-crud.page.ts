/**
 * Page object for item CRUD operations.
 * Covers navigation, creating, deleting, clicking items,
 * checking visibility, empty states, and the more menu.
 */
import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";
import { slugify } from "../../lib/slugify";

export class ItemsCrudPage {
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

  // ── Item Creation ──────────────────────────────────────

  /**
   * Create a new item by clicking the Add button and filling the form.
   * On mobile, uses the MobileAddItemSheet; on desktop, uses AddItemDialog.
   *
   * @param name - The name for the new item
   */
  async createItem(name: string) {
    await this.page.getByTestId("items-add-button").click();

    // Both desktop dialog and mobile sheet use a role-based name input
    const nameInput = this.page.getByRole("combobox", { name: /item name/i });
    await nameInput.waitFor({ state: "visible", timeout: Timeouts.api });
    await nameInput.fill(name);

    // Dismiss the TMDB search popover — Escape closes the combobox dropdown
    // without closing the parent dialog/sheet
    await nameInput.press("Escape");

    // Submit via the "Create" or "Add" button in the dialog/sheet
    const submitButton = this.page.getByRole("button", { name: /create/i });
    await submitButton.click();

    // Wait for the item to appear in the list
    await this.expectItemVisible(name);
  }

  // ── Item Visibility Assertions ─────────────────────────

  /**
   * Assert that an item with the given name is visible (card or tree item).
   *
   * @param name - The item name to check
   */
  async expectItemVisible(name: string) {
    const slug = slugify(name);
    const card = this.page.getByTestId(`item-card-${slug}`);
    const tree = this.page.getByTestId(`item-tree-${slug}`);

    await expect(card.or(tree)).toBeVisible({ timeout: Timeouts.api });
  }

  /**
   * Assert that an item with the given name is not visible (neither card nor tree item).
   *
   * @param name - The item name to check
   */
  async expectItemNotVisible(name: string) {
    const slug = slugify(name);
    const card = this.page.getByTestId(`item-card-${slug}`);
    const tree = this.page.getByTestId(`item-tree-${slug}`);

    await expect(card).not.toBeVisible({ timeout: Timeouts.api });
    await expect(tree).not.toBeVisible({ timeout: Timeouts.api });
  }

  // ── Item Interaction ───────────────────────────────────

  /**
   * Click on an item (card or tree item) to navigate to its detail page.
   *
   * @param name - The item name to click
   */
  async clickItem(name: string) {
    const slug = slugify(name);
    const card = this.page.getByTestId(`item-card-${slug}`);
    const tree = this.page.getByTestId(`item-tree-${slug}`);

    const target = card.or(tree);
    await target.waitFor({ state: "visible", timeout: Timeouts.api });
    await target.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Open the more menu (ellipsis dropdown) for a specific item.
   *
   * @param name - The item name whose more menu to open
   */
  async openMoreMenu(name: string) {
    const slug = slugify(name);
    const moreButton = this.page.getByTestId(`item-more-${slug}`);
    await moreButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await moreButton.click();
  }

  /**
   * Delete an item via its more menu dropdown.
   * Opens the more menu, clicks Delete, and confirms in the alert dialog.
   *
   * @param name - The item name to delete
   */
  async deleteItemViaMenu(name: string) {
    await this.openMoreMenu(name);

    // Click the "Delete" option in the dropdown menu
    await this.page.getByRole("menuitem", { name: /delete/i }).click();

    // Confirm deletion in the alert dialog
    const confirmButton = this.page.getByRole("button", { name: /^delete$/i });
    await confirmButton.waitFor({
      state: "visible",
      timeout: Timeouts.animation,
    });
    await confirmButton.click();

    // Wait for the item to disappear
    await this.expectItemNotVisible(name);
  }

  // ── Empty State ────────────────────────────────────────

  /** Assert that the items empty state is visible. */
  async expectEmptyState() {
    await expect(this.page.getByTestId("items-empty-state")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  // ── Item Count ─────────────────────────────────────────

  /**
   * Assert that the number of visible items matches the expected count.
   * Counts both card and tree item elements.
   *
   * @param count - The expected number of visible items
   */
  async expectItemCount(count: number) {
    // Use a broad selector that matches both item-card-* and item-tree-* testids
    const cards = this.page.locator("[data-testid^='item-card-']");
    const trees = this.page.locator("[data-testid^='item-tree-']");

    // One view mode is active at a time; check which has elements
    const cardCount = await cards.count();
    const treeCount = await trees.count();
    const totalCount = cardCount > 0 ? cardCount : treeCount;

    expect(totalCount).toBe(count);
  }

  // ── Helpers ────────────────────────────────────────────

  /**
   * Get a locator for an item (card or tree) by name.
   *
   * @param name - The item name
   * @returns A Locator matching the card or tree item
   */
  getItemLocator(name: string): Locator {
    const slug = slugify(name);
    return this.page
      .getByTestId(`item-card-${slug}`)
      .or(this.page.getByTestId(`item-tree-${slug}`));
  }
}
