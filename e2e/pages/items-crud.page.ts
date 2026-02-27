/**
 * Page object for item CRUD operations.
 * Covers navigation, creating, deleting, clicking items,
 * checking visibility, empty states, and the more menu.
 */
import type { Page, Locator } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";
import { slugify } from "../../lib/slugify";
import { getItemLocator, openItemMoreMenu } from "../config/item-locators";

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
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Item Creation ──────────────────────────────────────

  /**
   * Create a new item by clicking the Add button and filling the form.
   * On mobile, uses the MobileAddItemSheet; on desktop, uses AddItemDialog.
   *
   * @param name - The name for the new item
   */
  async createItem(name: string) {
    // Retry click + wait for hydration — on mobile the SSR'd button may not
    // have its React handler attached yet (Radix hydration race).
    const nameInput = this.page.getByRole("combobox", { name: /item name/i });
    await expect(async () => {
      await this.page.getByTestId("items-add-button").click();
      await expect(nameInput).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: Timeouts.api });
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
    const item = this.getItemLocator(name);
    await expect(item).toBeVisible({ timeout: Timeouts.api });
  }

  /**
   * Assert that an item with the given name is not visible (neither card nor tree item).
   *
   * @param name - The item name to check
   */
  async expectItemNotVisible(name: string) {
    const slug = slugify(name);
    // Check both individually — neither should be visible
    await expect(this.page.getByTestId(`item-card-${slug}`)).not.toBeVisible({
      timeout: Timeouts.api,
    });
    await expect(this.page.getByTestId(`item-tree-${slug}`)).not.toBeVisible({
      timeout: Timeouts.api,
    });
  }

  // ── Item Interaction ───────────────────────────────────

  /**
   * Click on an item (card or tree item) to navigate to its detail page.
   *
   * @param name - The item name to click
   */
  async clickItem(name: string) {
    const target = this.getItemLocator(name);
    await target.waitFor({ state: "visible", timeout: Timeouts.api });
    await target.click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Open the more menu (ellipsis dropdown) for a specific item.
   * Hovers the parent item to reveal the button (group-hover:opacity-100),
   * then clicks normally so Radix receives the full pointer event sequence.
   *
   * @param name - The item name whose more menu to open
   */
  async openMoreMenu(name: string) {
    await openItemMoreMenu(this.page, name);
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
    // CSS prefix selectors are needed here because item testids include dynamic
    // slugs (e.g., item-card-my-movie) and we need to count all of them.
    await expect
      .poll(
        async () => {
          const cardCount = await this.page
            .locator("[data-testid^='item-card-']")
            .count();
          const treeCount = await this.page
            .locator("[data-testid^='item-tree-']")
            .count();
          return cardCount > 0 ? cardCount : treeCount;
        },
        { timeout: Timeouts.api }
      )
      .toBe(count);
  }

  // ── Helpers ────────────────────────────────────────────

  /**
   * Get a locator for an item (card or tree) by name.
   *
   * @param name - The item name
   * @returns A Locator matching the card or tree item
   */
  getItemLocator(name: string): Locator {
    return getItemLocator(this.page, name);
  }
}
