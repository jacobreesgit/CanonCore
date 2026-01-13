/**
 * Page object for items management.
 * Provides helpers for CRUD operations, navigation, view switching,
 * and drag-and-drop operations for dnd-kit sortable components.
 *
 * @example
 * ```ts
 * await itemsPage.createItem("Item A");
 * await itemsPage.dragItemTo("Item A", "Item B");
 * await itemsPage.expectItemOrder(["Item B", "Item A"]);
 * ```
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Timeout for waiting for toast notifications to dismiss (matches Sonner default) */
const TOAST_DISMISS_TIMEOUT = 5000;

export class ItemsPage {
  readonly page: Page;
  readonly viewToggleTree: Locator;
  readonly viewToggleGrid: Locator;
  readonly addFolderButton: Locator;
  readonly addFolderDialog: Locator;
  readonly addFolderInput: Locator;
  readonly addFolderDescription: Locator;
  readonly addFolderSubmit: Locator;
  readonly addFolderCancel: Locator;
  readonly emptyState: Locator;
  readonly treeView: Locator;
  readonly gridView: Locator;
  readonly breadcrumbHome: Locator;
  readonly heroSection: Locator;
  readonly loadingSpinner: Locator;
  readonly sortDropdown: Locator;
  readonly filterDropdown: Locator;
  readonly editModeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.viewToggleTree = page.getByRole("button", { name: /tree view/i });
    this.viewToggleGrid = page.getByRole("button", { name: /grid view/i });
    // Use .first() to avoid strict mode violation when both toolbar and empty state buttons are visible
    this.addFolderButton = page
      .getByRole("button", { name: /add item/i })
      .first();
    this.addFolderDialog = page.getByRole("dialog", { name: /create item/i });
    this.addFolderInput = page.getByLabel(/item name/i);
    this.addFolderDescription = page.getByLabel(/description/i);
    this.addFolderSubmit = page.getByRole("button", { name: /^create$/i });
    this.addFolderCancel = page.getByRole("button", { name: /cancel/i });
    this.emptyState = page.getByText(/no items yet/i);
    this.treeView = page.getByTestId("items-tree-view");
    this.gridView = page.getByTestId("items-grid-view");
    // Target the SiteHeader breadcrumb nav
    this.breadcrumbHome = page
      .getByLabel("Breadcrumb")
      .getByRole("link", { name: /my items/i });
    this.heroSection = page.getByTestId("item-hero");
    this.loadingSpinner = page.getByTestId("items-loading");
    // Sort dropdown shows current sort option (Custom Order, Name A-Z, etc.)
    this.sortDropdown = page
      .getByRole("button", {
        name: /custom order|name a-z|name z-a|newest first|oldest first|recently updated/i,
      })
      .first();
    // Filter dropdown shows current filter option (All Items, Has Files, etc.)
    this.filterDropdown = page
      .getByRole("button", {
        name: /all items|has files|no files|synced|pending sync|sync error/i,
      })
      .first();
    this.editModeButton = page.getByRole("button", { name: /edit mode/i });
  }

  async goto() {
    await this.page.goto("/my-items");
  }

  async gotoItem(itemId: string) {
    await this.page.goto(`/my-items/${itemId}`);
  }

  async expectVisible() {
    await expect(this.page).toHaveURL(/\/my-items/);
  }

  async switchToTreeView() {
    await this.viewToggleTree.click();
  }

  async switchToGridView() {
    await this.viewToggleGrid.click();
  }

  /** Click the Edit button to enter edit mode */
  async enterEditMode() {
    await this.page.getByRole("button", { name: "Enter edit mode" }).click();
  }

  /** Click the Done button to exit edit mode */
  async exitEditMode() {
    await this.page.getByRole("button", { name: "Exit edit mode" }).click();
  }

  /** Check if currently in edit mode */
  async isInEditMode(): Promise<boolean> {
    return this.page
      .getByRole("button", { name: "Exit edit mode" })
      .isVisible();
  }

  async createItem(name: string, description?: string) {
    // Click add button and wait for dialog to appear
    await this.addFolderButton.click();
    await expect(this.addFolderDialog).toBeVisible({ timeout: 5000 });

    // Fill name and optional description
    await this.addFolderInput.fill(name);
    if (description) {
      await this.addFolderDescription.fill(description);
    }
    await expect(this.addFolderSubmit).toBeEnabled({ timeout: 2000 });
    await this.addFolderSubmit.click();

    // Wait for dialog to close (longer timeout for mobile)
    await expect(this.addFolderDialog).not.toBeVisible({ timeout: 15000 });
    // Wait for React state update to complete
    await this.page.waitForLoadState("networkidle");
    await this.expectItemVisible(name);
  }

  /**
   * Creates an item and expects an error. Dialog stays open on error.
   */
  async createItemExpectError(name: string): Promise<void> {
    // Click add button and wait for dialog to appear
    await this.addFolderButton.click();
    await expect(this.addFolderDialog).toBeVisible({ timeout: 5000 });

    // Fill and submit
    await this.addFolderInput.fill(name);
    await expect(this.addFolderSubmit).toBeEnabled({ timeout: 2000 });
    await this.addFolderSubmit.click();

    // Dialog stays open when there's an error - don't wait for it to close
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
    // Wait for the hero heading to show item name (works on mobile where breadcrumbs collapse)
    await expect(
      this.heroSection.getByRole("heading", { level: 1, name })
    ).toBeVisible({
      timeout: 15000,
    });
    // Wait for the Add item button to confirm ItemsView is rendered
    await expect(this.addFolderButton).toBeVisible({ timeout: 10000 });
  }

  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /**
   * Expects the hero section to be visible with optional title check.
   *
   * @param title - Optional title to verify in the hero heading
   */
  async expectHeroVisible(title?: string): Promise<void> {
    await expect(this.heroSection).toBeVisible({ timeout: 10000 });
    if (title) {
      await expect(
        this.heroSection.getByRole("heading", { name: title })
      ).toBeVisible();
    }
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

  /**
   * Opens the settings dialog for an item via context menu.
   *
   * @param name - Name of the item to open settings for
   */
  async openSettingsViaContextMenu(name: string) {
    await this.openContextMenu(name);
    await this.page.getByRole("menuitem", { name: /settings/i }).click();
    // Wait for settings dialog to appear
    await expect(
      this.page.getByRole("dialog", { name: /settings/i })
    ).toBeVisible({ timeout: 5000 });
  }

  /**
   * Renames an item through the settings dialog.
   *
   * @param oldName - Current name of the item
   * @param newName - New name for the item
   */
  async renameItemViaContextMenu(oldName: string, newName: string) {
    await this.openSettingsViaContextMenu(oldName);
    // Find the name input in the settings dialog (label is "Name")
    await this.page.getByLabel(/item name/i).fill(newName);
    // Click "Save Changes" button (single save for all settings)
    await this.page.getByRole("button", { name: /save changes/i }).click();
    // Wait for success toast
    await this.expectSuccessToast("Settings saved");
    // Wait for dialog to close automatically on success
    await expect(
      this.page.getByRole("dialog", { name: /settings/i })
    ).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Closes the settings dialog.
   */
  async closeSettingsDialog() {
    // Click the close button (X icon in the top right)
    await this.page.getByRole("button", { name: /close/i }).click();
    await expect(
      this.page.getByRole("dialog", { name: /settings/i })
    ).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Updates an item's description through the settings dialog.
   *
   * @param itemName - Name of the item to update
   * @param description - New description text
   */
  async updateDescriptionViaContextMenu(
    itemName: string,
    description: string
  ): Promise<void> {
    await this.openSettingsViaContextMenu(itemName);
    await this.page.getByLabel(/description/i).fill(description);
    // Click "Save Changes" button (single save for all settings)
    await this.page.getByRole("button", { name: /save changes/i }).click();
    // Wait for success toast
    await this.expectSuccessToast("Settings saved");
    // Wait for dialog to close automatically on success
    await expect(
      this.page.getByRole("dialog", { name: /settings/i })
    ).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Gets the description input value from the settings dialog.
   */
  async getDescriptionFromSettingsDialog(): Promise<string> {
    return this.page.getByLabel(/description/i).inputValue();
  }

  /**
   * Expects description text to be visible in the view.
   *
   * @param description - Description text to look for
   */
  async expectDescriptionVisible(description: string): Promise<void> {
    await expect(this.page.getByText(description)).toBeVisible();
  }

  /**
   * Gets the settings dialog locator.
   */
  getSettingsDialog() {
    return this.page.getByRole("dialog", { name: /settings/i });
  }

  /**
   * Expects the settings dialog to show a section for file type selection.
   *
   * @param fileType - The file type section to check for (media, artwork, subtitles)
   */
  async expectFileTypeSectionVisible(
    fileType: "media" | "artwork" | "subtitles"
  ) {
    const sectionLabel =
      fileType === "media"
        ? /primary media/i
        : fileType === "artwork"
          ? /primary artwork/i
          : /primary subtitle/i;
    await expect(
      this.getSettingsDialog().getByText(sectionLabel)
    ).toBeVisible();
  }

  /**
   * Expects a file option to be visible in the settings dialog.
   *
   * @param filename - The filename to look for
   */
  async expectFileOptionVisible(filename: string) {
    await expect(
      this.getSettingsDialog().getByText(filename, { exact: true })
    ).toBeVisible();
  }

  /**
   * Selects a file as primary in the settings dialog.
   *
   * @param filename - The filename to select as primary
   */
  async selectPrimaryFile(filename: string) {
    // Click on the file option to select it
    await this.getSettingsDialog().getByText(filename, { exact: true }).click();
    // Wait for network to settle (optimistic update + server call)
    await this.page.waitForLoadState("networkidle");
  }

  async deleteItemViaContextMenu(name: string) {
    await this.openContextMenu(name);
    // Wait for context menu to appear and click delete
    const deleteMenuItem = this.page.getByRole("menuitem", { name: /delete/i });
    await expect(deleteMenuItem).toBeVisible({ timeout: 5000 });
    await deleteMenuItem.click({ force: true });
    await this.page.getByRole("button", { name: /^delete$/i }).click();
    // Wait for confirmation dialog to close
    await expect(
      this.page.getByRole("dialog", { name: /delete/i })
    ).not.toBeVisible({ timeout: 10000 });
    // Wait for network to settle after deletion
    await this.page.waitForLoadState("networkidle");
  }

  async expectBreadcrumb(name: string) {
    // Scope to SiteHeader breadcrumb nav
    // Use exact matching to avoid partial matches (e.g., "Parent" matching "Grandparent")
    await expect(
      this.page
        .getByLabel("Breadcrumb")
        .getByRole("link", { name, exact: true })
    ).toBeVisible();
  }

  async clickBreadcrumb(name: string) {
    // Scope to SiteHeader breadcrumb nav
    // Use exact matching to avoid partial matches (e.g., "Parent" matching "Grandparent")
    await this.page
      .getByLabel("Breadcrumb")
      .getByRole("link", { name, exact: true })
      .click();
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

  /**
   * Selects a primary media file in settings dialog.
   *
   * @param filename - The filename to select as primary media
   */
  async selectPrimaryMedia(filename: string): Promise<void> {
    const select = this.page.getByRole("combobox", { name: /primary media/i });
    await select.click();
    await this.page
      .getByRole("option", { name: new RegExp(filename, "i") })
      .click();
  }

  /**
   * Selects a primary artwork file in settings dialog.
   *
   * @param filename - The filename to select as primary artwork
   */
  async selectPrimaryArtwork(filename: string): Promise<void> {
    const select = this.page.getByRole("combobox", {
      name: /primary artwork/i,
    });
    await select.click();
    await this.page
      .getByRole("option", { name: new RegExp(filename, "i") })
      .click();
  }

  /**
   * Selects a default subtitle file in settings dialog.
   *
   * @param filename - The filename to select as default subtitle
   */
  async selectDefaultSubtitle(filename: string): Promise<void> {
    const select = this.page.getByRole("combobox", {
      name: /default subtitle/i,
    });
    await select.click();
    await this.page
      .getByRole("option", { name: new RegExp(filename, "i") })
      .click();
  }

  /**
   * Collapses an item in tree view.
   *
   * @param name - Name of the item to collapse
   */
  async collapseItem(name: string): Promise<void> {
    const item = this.page.getByRole("listitem").filter({ hasText: name });
    const collapseButton = item.getByRole("button", {
      name: /collapse item/i,
    });
    await collapseButton.click();
  }

  /**
   * Expands an item in tree view.
   *
   * @param name - Name of the item to expand
   */
  async expandItem(name: string): Promise<void> {
    const item = this.page.getByRole("listitem").filter({ hasText: name });
    const expandButton = item.getByRole("button", { name: /expand item/i });
    await expandButton.click();
  }

  /**
   * Checks if an item has a collapse/expand button visible.
   *
   * @param name - Name of the item to check
   * @returns True if the item has children (can be collapsed/expanded)
   */
  async itemHasChildren(name: string): Promise<boolean> {
    const item = this.page.getByRole("listitem").filter({ hasText: name });
    const collapseButton = item.getByRole("button", {
      name: /collapse item|expand item/i,
    });
    return collapseButton.isVisible();
  }

  /**
   * Waits for the loading spinner to disappear and content to be ready.
   * Use this after navigation to ensure hydration completes.
   */
  async waitForLoadingComplete(): Promise<void> {
    // Wait for loading spinner to disappear (if visible)
    await expect(this.loadingSpinner).not.toBeVisible({ timeout: 10000 });
    // Ensure content is rendered (either empty state or tree/grid)
    await expect(
      this.emptyState.or(this.treeView).or(this.gridView).first()
    ).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expects the loading spinner to be visible.
   */
  async expectLoadingVisible(): Promise<void> {
    await expect(this.loadingSpinner).toBeVisible();
  }

  /**
   * Expects the loading spinner to not be visible.
   */
  async expectLoadingHidden(): Promise<void> {
    await expect(this.loadingSpinner).not.toBeVisible();
  }

  /**
   * Navigates to My Items and waits for loading to complete.
   * This is the preferred method when you need content to be ready.
   */
  async gotoAndWaitForContent(): Promise<void> {
    await this.goto();
    await this.waitForLoadingComplete();
  }

  /**
   * Navigates to an item detail page and waits for loading to complete.
   *
   * @param itemId - ID of the item to navigate to
   */
  async gotoItemAndWaitForContent(itemId: string): Promise<void> {
    await this.gotoItem(itemId);
    await this.waitForLoadingComplete();
  }

  /**
   * Collapses the hero section.
   */
  async collapseHero(): Promise<void> {
    await this.page.getByRole("button", { name: /collapse hero/i }).click();
  }

  /**
   * Expands the hero section.
   */
  async expandHero(): Promise<void> {
    await this.page.getByRole("button", { name: /expand hero/i }).click();
  }

  /**
   * Checks if the hero is currently collapsed.
   */
  async isHeroCollapsed(): Promise<boolean> {
    return this.page.getByRole("button", { name: /expand hero/i }).isVisible();
  }

  /**
   * Opens the sort dropdown and selects a sort option.
   *
   * @param option - The sort option label to select (e.g., "Name A-Z", "Created (Newest)")
   */
  async selectSortOption(option: string): Promise<void> {
    await this.sortDropdown.click();
    await this.page.getByRole("menuitemradio", { name: option }).click();
  }

  /**
   * Opens the filter dropdown and selects a filter option.
   *
   * @param option - The filter option label to select (e.g., "All Items", "Has Files")
   */
  async selectFilterOption(option: string): Promise<void> {
    await this.filterDropdown.click();
    await this.page.getByRole("menuitemradio", { name: option }).click();
  }

  /**
   * Gets the current sort option displayed in the dropdown.
   */
  async getCurrentSortOption(): Promise<string> {
    return (await this.sortDropdown.textContent()) ?? "";
  }

  /**
   * Gets the current filter option displayed in the dropdown.
   */
  async getCurrentFilterOption(): Promise<string> {
    return (await this.filterDropdown.textContent()) ?? "";
  }

  /**
   * Checks if edit mode button is disabled.
   */
  async isEditModeDisabled(): Promise<boolean> {
    const editButton = this.page.getByRole("button", {
      name: /enter edit mode/i,
    });
    return await editButton.isDisabled();
  }
}
