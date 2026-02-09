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

export class ItemsPage {
  readonly page: Page;
  private username: string;
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
  readonly sortDropdown: Locator;
  readonly filterDropdown: Locator;
  readonly editModeButton: Locator;

  constructor(page: Page, username: string) {
    this.page = page;
    this.username = username;
    this.viewToggleTree = page.getByRole("button", { name: /tree view/i });
    this.viewToggleGrid = page.getByRole("button", { name: /grid view/i });
    // Use .first() to avoid strict mode violation when both toolbar and empty state buttons are visible
    // Match both "Add Item" (empty state) and "Add" (toolbar with icon)
    this.addFolderButton = page
      .getByRole("button", { name: /^add( item)?$/i })
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
    this.heroSection = page.getByTestId("hero-carousel");
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
    await this.page.goto(`/u/${this.username}`);
  }

  async gotoItem(itemId: string) {
    await this.page.goto(`/u/${this.username}/${itemId}`);
  }

  async expectVisible() {
    await expect(this.page).toHaveURL(new RegExp(`/u/${this.username}`));
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

    // The TMDB combobox has a 300ms debounce search that opens a Radix popover.
    // Wait for debounce to fire, then dismiss the popover with Escape if it opened.
    // Escape is safe here: if the popover IS open, Radix closes the popover first
    // (not the dialog). If it's NOT open, we skip Escape entirely.
    await this.page.waitForTimeout(500);
    const tmdbPopover = this.page.locator(
      "[data-radix-popper-content-wrapper]"
    );
    if (await tmdbPopover.isVisible().catch(() => false)) {
      await this.page.keyboard.press("Escape");
      await expect(tmdbPopover).not.toBeVisible({ timeout: 3000 });
    }

    await expect(this.addFolderSubmit).toBeVisible({ timeout: 10000 });
    await expect(this.addFolderSubmit).toBeEnabled({ timeout: 5000 });
    // Use force: true to bypass re-checking actionability during click.
    // Under parallel load, React re-renders from TMDB search responses can
    // detach the button between actionability check and click dispatch.
    await this.addFolderSubmit.click({ timeout: 15000, force: true });

    // Wait for dialog to close
    await expect(this.addFolderDialog).not.toBeVisible({ timeout: 15000 });
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
    // Use .first() after .or() because GridItem renders name in two <h3> elements
    // (default view + hover overlay), both present in the DOM
    const treeItem = this.page
      .getByRole("listitem")
      .getByText(name, { exact: true });
    const gridItem = this.page
      .locator("[data-id]")
      .getByText(name, { exact: true });
    await expect(treeItem.or(gridItem).first()).not.toBeVisible();
  }

  async clickItem(name: string) {
    // Target items in tree/grid views, not breadcrumbs
    // Tree view: items are in listitem elements
    const treeItem = this.page
      .getByRole("listitem")
      .getByText(name, { exact: true });
    // Grid view: items are buttons with the item name as accessible name
    const gridButton = this.page.getByRole("button", { name, exact: true });
    // Legacy selector for backward compatibility
    const gridItem = this.page
      .locator("[data-id]")
      .getByText(name, { exact: true });
    await treeItem.or(gridButton).or(gridItem).first().click();
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
    // Target items in tree/grid views within main content, not sidebar
    const mainContent = this.page.getByRole("main");
    // Tree items are listitems, grid items are buttons with data-id
    const treeItem = mainContent
      .getByRole("listitem")
      .getByText(name, { exact: true });
    const gridItem = mainContent
      .locator("[data-id]")
      .getByText(name, { exact: true });
    // Also match buttons directly (grid cards render as buttons)
    const gridButton = mainContent.getByRole("button", { name, exact: true });
    return treeItem.or(gridItem).or(gridButton).first();
  }

  async openContextMenu(name: string) {
    // Dismiss any open overlays first
    await this.page.keyboard.press("Escape");

    // Get the container element (listitem for tree, div[data-id] for grid)
    const mainContent = this.page.getByRole("main");
    const treeContainer = mainContent
      .getByRole("listitem")
      .filter({ hasText: name });
    const gridContainer = mainContent
      .locator("[data-id]")
      .filter({ hasText: name });
    const container = treeContainer.or(gridContainer).first();

    await container.scrollIntoViewIfNeeded();

    // Click the more button directly — Playwright treats opacity:0 elements as
    // visible (they have bounding boxes), so no explicit hover needed.
    // This avoids the hover → scale-105 → dropdown-shifts instability loop
    // that causes "element is not stable" failures.
    const moreButton = container.getByRole("button", {
      name: /more options/i,
    });
    await moreButton.click();

    // Wait for the dropdown menu to fully open before callers interact with items
    await expect(this.page.getByRole("menu")).toBeVisible();
  }

  /**
   * Opens the settings dialog for an item via context menu.
   *
   * @param name - Name of the item to open settings for
   */
  async openSettingsViaContextMenu(name: string) {
    await this.openContextMenu(name);
    await this.page.getByRole("menuitem", { name: /settings/i }).click();
    await expect(this.getSettingsDialog()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Renames an item through the settings dialog.
   *
   * @param oldName - Current name of the item
   * @param newName - New name for the item
   */
  async renameItemViaContextMenu(oldName: string, newName: string) {
    await this.openSettingsViaContextMenu(oldName);
    const dialog = this.getSettingsDialog();
    await dialog.getByLabel(/item name/i).fill(newName);
    // Wait for Save to be enabled (React state update from fill)
    const saveButton = dialog.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled({ timeout: 3000 });
    await saveButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
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
    const dialog = this.getSettingsDialog();
    await dialog.getByLabel(/description/i).fill(description);
    // Wait for Save to be enabled (React state update from fill)
    const saveButton = dialog.getByRole("button", { name: /save changes/i });
    await expect(saveButton).toBeEnabled({ timeout: 3000 });
    await saveButton.click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
  }

  /**
   * Gets the description input value from the settings dialog.
   */
  async getDescriptionFromSettingsDialog(): Promise<string> {
    // Scope to settings dialog to avoid matching create item dialog's description field
    return this.getSettingsDialog()
      .getByLabel(/description/i)
      .inputValue();
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
  }

  async deleteItemViaContextMenu(name: string) {
    await this.openContextMenu(name);
    // Use dispatchEvent because Next.js dev overlay portal can intercept clicks on mobile
    await this.page
      .getByRole("menuitem", { name: /^delete$/i })
      .dispatchEvent("click");
    // Wait for delete confirmation dialog
    const deleteDialog = this.page.getByRole("alertdialog", {
      name: /delete/i,
    });
    await expect(deleteDialog).toBeVisible({ timeout: 5000 });
    await deleteDialog.getByRole("button", { name: /^delete$/i }).click();
    await expect(deleteDialog).not.toBeVisible({ timeout: 10000 });
  }

  /** Scroll to top so the auto-hiding header becomes visible. */
  async ensureHeaderVisible() {
    await this.page.evaluate(() => {
      const main = document.getElementById("main-content");
      (main ?? window).scrollTo(0, 0);
    });
    await expect(this.page.getByLabel("Breadcrumb")).toBeVisible({
      timeout: 3000,
    });
  }

  async expectBreadcrumb(name: string) {
    await this.ensureHeaderVisible();
    await expect(
      this.page
        .getByLabel("Breadcrumb")
        .getByRole("link", { name, exact: true })
    ).toBeVisible({ timeout: 10000 });
  }

  async clickBreadcrumb(name: string) {
    await this.ensureHeaderVisible();
    await this.page
      .getByLabel("Breadcrumb")
      .getByRole("link", { name, exact: true })
      .click();
  }

  /**
   * Gets a tree item's drag handle locator by item name.
   * Uses aria-label to specifically target the drag handle button.
   */
  getTreeItemDragHandle(name: string): Locator {
    const item = this.page.locator(`li`).filter({ hasText: name }).first();
    return item.getByRole("button", { name: "Drag handle" });
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
   * Waits for content to be ready after navigation.
   * Ensures hydration completes before interacting with the page.
   */
  async waitForLoadingComplete(): Promise<void> {
    // Ensure content is rendered (empty state, tree/grid, or pinned grid)
    const pinnedGrid = this.getPinnedItemsGrid();
    await expect(
      this.emptyState.or(this.treeView).or(this.gridView).or(pinnedGrid).first()
    ).toBeVisible({ timeout: 10000 });
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
   * Opens the sort dropdown and selects a sort option.
   * Handles both desktop dropdown and mobile Options sheet.
   *
   * @param option - The sort option label to select (e.g., "Name A-Z", "Created (Newest)")
   */
  async selectSortOption(option: string): Promise<void> {
    // Wait for either mobile or desktop control to be visible
    // Use exact: true to prevent matching "More options" buttons on grid items
    const mobileOptionsButton = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });
    const desktopSortDropdown = this.sortDropdown;

    // Wait for one of them to appear (.first() after .or() per Playwright best practices)
    await expect(
      mobileOptionsButton.or(desktopSortDropdown).first()
    ).toBeVisible({
      timeout: 10000,
    });

    // Now check which one is visible
    const isMobile = await mobileOptionsButton.isVisible();

    if (isMobile) {
      // Mobile: Use Options sheet
      await mobileOptionsButton.click();
      await this.page.getByRole("option", { name: option }).click();
      // Close drawer by clicking outside or pressing escape
      await this.page.keyboard.press("Escape");
    } else {
      // Desktop: Use dropdown
      await desktopSortDropdown.click();
      await this.page.getByRole("menuitemradio", { name: option }).click();
    }
  }

  /**
   * Opens the filter dropdown and selects a filter option.
   * Handles both desktop dropdown and mobile Options sheet.
   *
   * @param option - The filter option label to select (e.g., "All Items", "Has Files")
   */
  async selectFilterOption(option: string): Promise<void> {
    // Wait for either mobile or desktop control to be visible
    // Use exact: true to prevent matching "More options" buttons on grid items
    const mobileOptionsButton = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });
    const desktopFilterDropdown = this.filterDropdown;

    // Wait for one of them to appear (.first() after .or() per Playwright best practices)
    await expect(
      mobileOptionsButton.or(desktopFilterDropdown).first()
    ).toBeVisible({
      timeout: 10000,
    });

    // Now check which one is visible
    const isMobile = await mobileOptionsButton.isVisible();

    if (isMobile) {
      // Mobile: Use Options sheet
      await mobileOptionsButton.click();
      await this.page.getByRole("option", { name: option }).click();
      // Close drawer by clicking outside or pressing escape
      await this.page.keyboard.press("Escape");
    } else {
      // Desktop: Use dropdown
      await desktopFilterDropdown.click();
      await this.page.getByRole("menuitemradio", { name: option }).click();
    }
  }

  /**
   * Gets the current sort option displayed in the dropdown.
   * Handles both desktop dropdown and mobile Options sheet.
   */
  async getCurrentSortOption(): Promise<string> {
    // Check if mobile Options button exists
    // Use exact: true to prevent matching "More options" buttons on grid items
    const mobileOptionsButton = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });
    const isMobile = await mobileOptionsButton.isVisible();

    if (isMobile) {
      // Mobile: Open Options sheet and find selected sort option
      await mobileOptionsButton.click();
      const selectedOption = this.page
        .getByRole("listbox", { name: /sort options/i })
        .getByRole("option", { selected: true });
      const text = (await selectedOption.textContent()) ?? "";
      await this.page.keyboard.press("Escape");
      return text;
    }
    // Desktop: Read from dropdown button
    return (await this.sortDropdown.textContent()) ?? "";
  }

  /**
   * Gets the current filter option displayed in the dropdown.
   * Handles both desktop dropdown and mobile Options sheet.
   */
  async getCurrentFilterOption(): Promise<string> {
    // Check if mobile Options button exists
    // Use exact: true to prevent matching "More options" buttons on grid items
    const mobileOptionsButton = this.page.getByRole("button", {
      name: "Options",
      exact: true,
    });
    const isMobile = await mobileOptionsButton.isVisible();

    if (isMobile) {
      // Mobile: Open Options sheet and find selected filter option
      await mobileOptionsButton.click();
      const selectedOption = this.page
        .getByRole("listbox", { name: /filter options/i })
        .getByRole("option", { selected: true });
      const text = (await selectedOption.textContent()) ?? "";
      await this.page.keyboard.press("Escape");
      return text;
    }
    // Desktop: Read from dropdown button
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

  // ==================== Bulk Selection Methods ====================

  /**
   * Gets the bulk actions toolbar locator.
   */
  getBulkActionsToolbar(): Locator {
    return this.page
      .locator('[class*="bulk"]')
      .filter({ hasText: /selected|select items/i });
  }

  /**
   * Gets the select-all button in the bulk actions toolbar.
   */
  getSelectAllButton(): Locator {
    // Button is now visible on all viewports
    return this.page.getByRole("button", {
      name: /^(select all|deselect all)$/i,
    });
  }

  /**
   * Gets the bulk delete button.
   */
  getBulkDeleteButton(): Locator {
    // New UI: Button text is hidden on mobile (sm:inline)
    // Find by destructive button in the fixed bottom toolbar
    // Use the presence of the shadow-2xl class (unique to bulk toolbar) to scope
    return this.page
      .locator('[class*="shadow-2xl"]') // Bulk actions toolbar container
      .locator('button[class*="bg-destructive"]'); // Destructive variant button
  }

  /**
   * Selects an item by clicking its checkbox in edit mode.
   *
   * @param name - Name of the item to select
   */
  async selectItem(name: string): Promise<void> {
    const item = this.page
      .locator("[data-id]")
      .filter({ hasText: name })
      .first();
    const checkbox = item.getByRole("checkbox", {
      name: new RegExp(`select ${name}`, "i"),
    });
    await checkbox.click();
  }

  /**
   * Toggles the select-all button in the bulk actions toolbar.
   */
  async toggleSelectAll(): Promise<void> {
    await this.getSelectAllButton().click();
  }

  /**
   * Gets the selection count from the bulk actions toolbar.
   */
  async getSelectionCount(): Promise<number> {
    const text = await this.page
      .locator('[class*="bulk"]')
      .filter({ hasText: /selected/i })
      .textContent();
    const match = text?.match(/(\d+)\s*selected/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Clicks the bulk delete button and confirms deletion in the dialog.
   * Handles the full flow: click delete button → wait for dialog → confirm.
   */
  async clickBulkDelete(): Promise<void> {
    await this.getBulkDeleteButton().click();
    // Wait for confirmation dialog
    await expect(
      this.page.getByRole("dialog", { name: /delete items/i })
    ).toBeVisible({ timeout: 5000 });
    // Click the confirm Delete button in the dialog
    await this.page.getByRole("button", { name: "Delete" }).click();
    // Wait for dialog to close
    await expect(
      this.page.getByRole("dialog", { name: /delete items/i })
    ).not.toBeVisible({ timeout: 10000 });
  }

  /**
   * Expects the bulk actions toolbar to show a specific selection count.
   *
   * @param count - Expected number of selected items
   */
  async expectSelectionCount(count: number): Promise<void> {
    // New UI shows count in a badge (always visible on both desktop and mobile)
    const badge = this.page
      .locator('[class*="rounded-full"][class*="tabular-nums"]')
      .filter({ hasText: new RegExp(`^${count}$`) });
    await expect(badge).toBeVisible({ timeout: 5000 });

    // Note: Text labels are hidden on mobile (sm:inline class), so we only check the badge
    // which is always visible and contains the actual count
  }

  /**
   * Expects the bulk delete button to be visible with the specified count.
   *
   * @param count - Number of items to be deleted
   */
  async expectBulkDeleteButton(_count: number): Promise<void> {
    // New UI: Delete button no longer shows count in text (just "Delete")
    await expect(this.getBulkDeleteButton()).toBeVisible();
    await expect(this.getBulkDeleteButton()).toBeEnabled();
  }

  /**
   * Expects the bulk delete button to not be visible (no items selected).
   */
  async expectNoBulkDeleteButton(): Promise<void> {
    // New UI: Button is always visible but disabled when count is 0
    await expect(this.getBulkDeleteButton()).toBeDisabled();
  }

  // ==================== Pin/Unpin Methods ====================

  /**
   * Ensures the sidebar is open. On mobile, the sidebar may be collapsed by default.
   */
  private async ensureSidebarOpen(): Promise<void> {
    const sidebar = this.page.locator('[data-sidebar="sidebar"]');
    const isVisible = await sidebar.isVisible().catch(() => false);

    if (!isVisible) {
      const trigger = this.page.getByTestId("sidebar-trigger");
      if (await trigger.isVisible()) {
        await trigger.click();
        await expect(sidebar).toBeVisible({ timeout: 5000 });
      }
    }
  }

  /**
   * Pins an item to the sidebar via context menu.
   * Waits for the item to appear in the pinned grid (confirms server action completed).
   *
   * @param name - Name of the item to pin
   */
  async pinItemViaContextMenu(name: string): Promise<void> {
    await this.openContextMenu(name);
    await this.page.getByRole("menuitem", { name: /pin to sidebar/i }).click();
    // Wait for the pinned item to appear in the profile page grid
    // This is the actual UI change — much more reliable than asserting on a transient toast
    const pinnedGrid = this.getPinnedItemsGrid();
    await expect(
      pinnedGrid.getByText(name, { exact: true }).first()
    ).toBeVisible({ timeout: 10000 });
  }

  /**
   * Unpins an item from the sidebar via context menu.
   * Waits for the item to disappear from the pinned grid (confirms server action completed).
   *
   * @param name - Name of the item to unpin
   */
  async unpinItemViaContextMenu(name: string): Promise<void> {
    await this.openContextMenu(name);
    await this.page
      .getByRole("menuitem", { name: /unpin from sidebar/i })
      .click();
    // Wait for the item to disappear from the pinned grid
    // This is the actual UI change — much more reliable than asserting on a transient toast
    const pinnedGrid = this.getPinnedItemsGrid();
    await expect(
      pinnedGrid.getByText(name, { exact: true }).first()
    ).not.toBeVisible({ timeout: 10000 });
  }

  /**
   * Checks if an item appears as a pinned sub-item under My Items in the sidebar.
   * Pinned items are rendered as SidebarMenuSubButton inside the My Items collapsible.
   * The My Items section auto-expands when there are pinned items.
   *
   * @param name - Name of the item to look for
   */
  async expectItemPinnedInSidebar(name: string): Promise<void> {
    // Ensure sidebar is visible
    await this.ensureSidebarOpen();

    // Item should appear as a sub-item (SidebarMenuSubButton) under My Items
    // The section auto-expands when there are active pinned items
    const pinnedItem = this.page.locator(
      '[data-slot="sidebar-menu-sub-button"]',
      {
        hasText: name,
      }
    );
    // router.refresh() after pin takes ~2s to propagate to sidebar
    await expect(pinnedItem).toBeVisible({ timeout: 10000 });
  }

  /**
   * Checks that an item is NOT pinned in the sidebar (not a sub-item under My Items).
   *
   * @param name - Name of the item that should not be pinned
   */
  async expectItemNotPinnedInSidebar(name: string): Promise<void> {
    // Ensure sidebar is visible
    await this.ensureSidebarOpen();

    // Find sub-buttons in sidebar with this name
    const pinnedItem = this.page.locator(
      '[data-slot="sidebar-menu-sub-button"]',
      {
        hasText: name,
      }
    );
    // Should not be visible as a pinned item
    await expect(pinnedItem).not.toBeVisible();
  }

  /**
   * Checks that there are pinned items visible under My Items.
   */
  async expectPinnedSectionVisible(): Promise<void> {
    // Ensure sidebar is visible
    await this.ensureSidebarOpen();

    // Check for any sub-items (pinned items) - section auto-expands when items exist
    const pinnedItems = this.page.locator(
      '[data-slot="sidebar-menu-sub-button"]'
    );
    await expect(pinnedItems.first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Checks that there are no pinned items under My Items.
   */
  async expectPinnedSectionNotVisible(): Promise<void> {
    // Ensure sidebar is visible
    await this.ensureSidebarOpen();

    // There should be no sub-items under My Items
    const pinnedItems = this.page.locator(
      '[data-slot="sidebar-menu-sub-button"]'
    );
    await expect(pinnedItems).not.toBeVisible();
  }

  /**
   * Clicks on a pinned item in the sidebar to navigate to it.
   * Pinned items are rendered as SidebarMenuSubButton inside the My Items collapsible.
   *
   * @param name - Name of the pinned item to click
   */
  async clickPinnedItem(name: string): Promise<void> {
    // Ensure sidebar is visible
    await this.ensureSidebarOpen();

    // Click the pinned item (sub-button) - section auto-expands when items exist
    const pinnedItem = this.page.locator(
      '[data-slot="sidebar-menu-sub-button"]',
      {
        hasText: name,
      }
    );
    await pinnedItem.click();
  }

  // ==================== Profile Page Pinned Grid Methods ====================

  /**
   * Gets the pinned items grid locator on the profile page (main content).
   * This is separate from the sidebar pinned items.
   */
  getPinnedItemsGrid(): Locator {
    return this.page.getByTestId("pinned-items-grid");
  }

  /**
   * Checks that the pinned items grid section is visible on the profile page.
   */
  async expectPinnedGridVisible(): Promise<void> {
    await expect(this.getPinnedItemsGrid()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Checks that the pinned items grid section is NOT visible on the profile page.
   */
  async expectPinnedGridNotVisible(): Promise<void> {
    await expect(this.getPinnedItemsGrid()).not.toBeVisible();
  }

  /**
   * Checks that an item appears in the pinned items grid on the profile page.
   *
   * @param name - Name of the item to look for
   */
  async expectItemInPinnedGrid(name: string): Promise<void> {
    const pinnedGrid = this.getPinnedItemsGrid();
    // Use .first() because GridItem renders the name in two <h3> elements
    // (default view + hover overlay), both present in the DOM
    await expect(
      pinnedGrid.getByText(name, { exact: true }).first()
    ).toBeVisible({
      timeout: 5000,
    });
  }

  /**
   * Checks that an item does NOT appear in the pinned items grid.
   *
   * @param name - Name of the item that should not be in pinned grid
   */
  async expectItemNotInPinnedGrid(name: string): Promise<void> {
    const pinnedGrid = this.getPinnedItemsGrid();
    await expect(
      pinnedGrid.getByText(name, { exact: true }).first()
    ).not.toBeVisible();
  }

  /**
   * Clicks on an item in the pinned items grid.
   *
   * @param name - Name of the pinned item to click
   */
  async clickItemInPinnedGrid(name: string): Promise<void> {
    const pinnedGrid = this.getPinnedItemsGrid();
    await pinnedGrid.getByRole("button", { name, exact: true }).click();
  }

  /**
   * Gets the count of items in the pinned items grid.
   */
  async getPinnedGridItemCount(): Promise<number> {
    const pinnedGrid = this.getPinnedItemsGrid();
    // Grid items are buttons with data-id
    const items = await pinnedGrid.locator("[data-id]").count();
    return items;
  }
}
