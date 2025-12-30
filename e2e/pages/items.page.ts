/**
 * Page object for items (folders) management.
 * Provides helpers for CRUD operations, navigation, view switching,
 * and drag-and-drop operations for dnd-kit sortable components.
 *
 * @example
 * ```ts
 * await itemsPage.createItem("Folder A");
 * await itemsPage.dragItemTo("Folder A", "Folder B");
 * await itemsPage.expectItemOrder(["Folder B", "Folder A"]);
 * ```
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class ItemsPage {
  readonly page: Page;
  readonly viewToggleTree: Locator;
  readonly viewToggleGrid: Locator;
  readonly addItemButton: Locator;
  readonly addItemInput: Locator;
  readonly addItemSubmit: Locator;
  readonly addItemCancel: Locator;
  readonly emptyState: Locator;
  readonly treeView: Locator;
  readonly gridView: Locator;
  readonly breadcrumbHome: Locator;

  constructor(page: Page) {
    this.page = page;
    this.viewToggleTree = page.getByRole("button", { name: /tree view/i });
    this.viewToggleGrid = page.getByRole("button", { name: /grid view/i });
    this.addItemButton = page.getByRole("button", { name: /add folder/i });
    this.addItemInput = page.getByPlaceholder(/folder name/i);
    this.addItemSubmit = page.getByRole("button", { name: /^add$/i });
    this.addItemCancel = page
      .locator("button")
      .filter({ has: page.locator("svg.tabler-icon-x") });
    this.emptyState = page.getByText(/no folders yet/i);
    this.treeView = page.locator("ul.space-y-0\\.5");
    this.gridView = page.locator(".grid.grid-cols-2");
    this.breadcrumbHome = page.getByRole("link", { name: /my files/i });
  }

  async goto() {
    await this.page.goto("/dashboard");
  }

  async gotoItem(itemId: string) {
    await this.page.goto(`/dashboard/${itemId}`);
  }

  async expectVisible() {
    await expect(this.page).toHaveURL(/\/dashboard/);
  }

  async switchToTreeView() {
    await this.viewToggleTree.click();
  }

  async switchToGridView() {
    await this.viewToggleGrid.click();
  }

  async createItem(name: string) {
    // Click add button and wait for input to appear
    await this.addItemButton.click();
    await expect(this.addItemInput).toBeVisible({ timeout: 5000 });

    // Fill and submit
    await this.addItemInput.fill(name);
    await expect(this.addItemSubmit).toBeEnabled({ timeout: 2000 });
    await this.addItemSubmit.click();

    // Wait for input to close (longer timeout for mobile)
    await expect(this.addItemInput).not.toBeVisible({ timeout: 15000 });
    // Wait for React state update to complete
    await this.page.waitForLoadState("networkidle");
    await this.expectItemVisible(name);
  }

  /**
   * Creates an item and expects success. Use createItemExpectError for error cases.
   */
  async createItemExpectError(name: string): Promise<void> {
    // Click add button and wait for input to appear
    await this.addItemButton.click();
    await expect(this.addItemInput).toBeVisible({ timeout: 5000 });

    // Fill and submit
    await this.addItemInput.fill(name);
    await expect(this.addItemSubmit).toBeEnabled({ timeout: 2000 });
    await this.addItemSubmit.click();

    // Input stays open when there's an error - don't wait for it to close
  }

  async expectItemVisible(name: string) {
    // Target items in tree/grid views, not breadcrumbs
    // Use listitem role for tree items or data-id for grid items
    const treeItem = this.page
      .getByRole("listitem")
      .getByText(name, { exact: true });
    const gridItem = this.page
      .locator("[data-id]")
      .getByText(name, { exact: true });
    await expect(treeItem.or(gridItem).first()).toBeVisible({
      timeout: 10000,
    });
  }

  async expectItemNotVisible(name: string) {
    // Target items in tree/grid views, not breadcrumbs
    const treeItem = this.page
      .getByRole("listitem")
      .getByText(name, { exact: true });
    const gridItem = this.page
      .locator("[data-id]")
      .getByText(name, { exact: true });
    await expect(treeItem.or(gridItem)).not.toBeVisible();
  }

  async clickItem(name: string) {
    // Target items in tree/grid views, not breadcrumbs
    const treeItem = this.page
      .getByRole("listitem")
      .getByText(name, { exact: true });
    const gridItem = this.page
      .locator("[data-id]")
      .getByText(name, { exact: true });
    await treeItem.or(gridItem).first().click();
    // Wait for navigation and page content to be ready
    await this.page.waitForLoadState("networkidle");
    await this.page.waitForLoadState("domcontentloaded");
    // Wait for the clicked item to appear in breadcrumbs (confirms page loaded)
    await expect(this.page.getByRole("button", { name })).toBeVisible({
      timeout: 15000,
    });
    // Wait for the Add folder button to confirm ItemsView is rendered
    await expect(this.addItemButton).toBeVisible({ timeout: 10000 });
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  getItemLocator(name: string): Locator {
    // Target items in tree/grid views, not breadcrumbs
    const treeItem = this.page
      .getByRole("listitem")
      .getByText(name, { exact: true });
    const gridItem = this.page
      .locator("[data-id]")
      .getByText(name, { exact: true });
    return treeItem.or(gridItem).first();
  }

  async openContextMenu(name: string) {
    const item = this.getItemLocator(name);
    await item.click({ button: "right" });
  }

  async renameItemViaContextMenu(oldName: string, newName: string) {
    await this.openContextMenu(oldName);
    await this.page.getByRole("menuitem", { name: /rename/i }).click();
    await this.page.getByRole("textbox").fill(newName);
    await this.page.getByRole("button", { name: /^rename$/i }).click();
    // Wait for rename dialog to close
    await expect(
      this.page.getByRole("dialog", { name: /rename/i })
    ).not.toBeVisible({ timeout: 10000 });
  }

  async deleteItemViaContextMenu(name: string) {
    await this.openContextMenu(name);
    await this.page.getByRole("menuitem", { name: /delete/i }).click();
    await this.page.getByRole("button", { name: /^delete$/i }).click();
    // Wait for confirmation dialog to close
    await expect(
      this.page.getByRole("dialog", { name: /delete/i })
    ).not.toBeVisible({ timeout: 10000 });
  }

  async expectBreadcrumb(name: string) {
    await expect(this.page.getByRole("button", { name })).toBeVisible();
  }

  async clickBreadcrumb(name: string) {
    await this.page.getByRole("button", { name }).click();
  }

  /**
   * Gets a tree item's drag handle locator by item name.
   * Uses data-id attribute for reliable selection in dnd-kit components.
   */
  getTreeItemDragHandle(name: string): Locator {
    const item = this.page.locator(`li`).filter({ hasText: name }).first();
    return item.locator("button").first();
  }

  /**
   * Gets a grid item locator by item name.
   * Uses the data-id attribute for reliable selection.
   */
  getGridItemByName(name: string): Locator {
    return this.page.locator(`div[data-id]`).filter({ hasText: name }).first();
  }

  /**
   * Drags an item to another item's position using Playwright's dragTo.
   * Works for both tree and grid views.
   *
   * @param sourceName - Name of the item to drag
   * @param targetName - Name of the item to drop onto
   */
  async dragItemTo(sourceName: string, targetName: string): Promise<void> {
    const source = this.getItemLocator(sourceName);
    const target = this.getItemLocator(targetName);

    await source.dragTo(target);
    // Wait for network to settle after drag operation
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Drags a tree item using its drag handle to another position.
   * More precise for tree view drag operations.
   *
   * @param sourceName - Name of the item to drag
   * @param targetName - Name of the item to drop onto
   */
  async dragTreeItemTo(sourceName: string, targetName: string): Promise<void> {
    const sourceHandle = this.getTreeItemDragHandle(sourceName);
    const target = this.getItemLocator(targetName);

    await sourceHandle.dragTo(target);
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Drags a tree item right to nest it under another item.
   * Uses offset positioning to trigger dnd-kit indent behavior.
   *
   * @param sourceName - Name of the item to drag
   * @param targetName - Name of the parent to nest under
   */
  async dragItemToNest(sourceName: string, targetName: string): Promise<void> {
    const source = this.getItemLocator(sourceName);
    const target = this.getItemLocator(targetName);

    const targetBox = await target.boundingBox();
    if (targetBox) {
      // Drag to the right side to trigger nesting
      await source.dragTo(target, {
        targetPosition: { x: targetBox.width - 10, y: targetBox.height / 2 },
      });
    }
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Verifies the order of items in the current view.
   * Checks that items appear in the expected sequence.
   *
   * @param expectedOrder - Array of item names in expected order
   */
  async expectItemOrder(expectedOrder: string[]): Promise<void> {
    const items = await this.page
      .locator("[data-id]")
      .filter({ hasText: /\w+/ })
      .allTextContents();

    // Filter to only the items we care about
    const actualOrder = items.filter((text) =>
      expectedOrder.some((name) => text.includes(name))
    );

    for (let i = 0; i < expectedOrder.length - 1; i++) {
      const currentIdx = actualOrder.findIndex((t) =>
        t.includes(expectedOrder[i])
      );
      const nextIdx = actualOrder.findIndex((t) =>
        t.includes(expectedOrder[i + 1])
      );
      expect(currentIdx).toBeLessThan(nextIdx);
    }
  }

  /**
   * Gets all visible item names in their current order.
   *
   * @returns Array of item names
   */
  async getItemNames(): Promise<string[]> {
    const elements = await this.page.locator("[data-id]").all();
    const names: string[] = [];
    for (const el of elements) {
      const text = await el.textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  /**
   * Expects a toast with the given message to be visible.
   * Uses data-sonner-toast attribute for reliable selection.
   *
   * @param message - Text to match in the toast
   */
  async expectToast(message: string): Promise<void> {
    const toast = this.page
      .locator("[data-sonner-toast]")
      .filter({ hasText: message });
    await expect(toast.first()).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expects a success toast with the given message to be visible.
   *
   * @param message - Text to match in the toast (substring match)
   */
  async expectSuccessToast(message: string): Promise<void> {
    await this.expectToast(message);
  }

  /**
   * Expects an error toast with the given message to be visible.
   *
   * @param message - Text to match in the toast (substring match)
   */
  async expectErrorToast(message: string): Promise<void> {
    await this.expectToast(message);
  }

  /**
   * Waits for all toasts to disappear (auto-dismiss or manual).
   * Toasts have 4s duration, so with multiple toasts this may take up to 15s.
   * Uses data-sonner-toast attribute for reliable selection.
   */
  async waitForToastToDisappear(): Promise<void> {
    // Move mouse away from toast area (top-right) to prevent hover-pause
    await this.page.mouse.move(100, 300);

    // Wait for all sonner toasts to disappear using data attribute
    const toasts = this.page.locator("[data-sonner-toast]");
    await expect(toasts).toHaveCount(0, { timeout: 15000 });
  }
}
