/**
 * Page object for item hierarchy operations.
 * Covers adding child items via the more menu, collapsing/expanding
 * tree nodes, and verifying parent-child nesting relationships.
 *
 * Note: My Items page uses grid view (item-card-*).
 * Item detail pages use tree view (item-tree-*) for children.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";
import { slugify } from "../../lib/slugify";
import { getItemLocator, openItemMoreMenu } from "../config/item-locators";

export class ItemsHierarchyPage {
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

  // ── Helpers ─────────────────────────────────────────────

  private getItemLocator(name: string) {
    return getItemLocator(this.page, name);
  }

  private async openMoreMenu(name: string) {
    await openItemMoreMenu(this.page, name);
  }

  // ── Add Child ────────────────────────────────────────────

  /**
   * Add a child item to a parent via the more options menu.
   * Opens the more menu, selects "Add Child Item",
   * fills in the child name, and submits the dialog.
   */
  async addChildItem(parentName: string, childName: string) {
    await this.openMoreMenu(parentName);

    await this.page.getByRole("menuitem", { name: "Add Child Item" }).click();

    // Fill the name field in the add item dialog and submit
    const nameInput = this.page.getByRole("combobox", { name: /item name/i });
    await nameInput.waitFor({ state: "visible", timeout: Timeouts.api });
    await nameInput.fill(childName);
    await nameInput.press("Escape");

    await this.page.getByRole("button", { name: /create/i }).click();

    // Wait for dialog to close
    await expect(
      this.page.getByRole("dialog", { name: /create item/i })
    ).not.toBeVisible({ timeout: Timeouts.api });
  }

  // ── View Mode ───────────────────────────────────────────

  /**
   * Switch to tree view on the current item detail page.
   * Desktop: clicks the view dropdown. Mobile: opens the options sheet.
   */
  async switchToTree() {
    if (this.isMobile) {
      const optionsTrigger = this.page.getByRole("button", {
        name: "Options",
        exact: true,
      });
      await optionsTrigger.waitFor({
        state: "visible",
        timeout: Timeouts.navigation,
      });
      await optionsTrigger.click();
      const treeOption = this.page.getByRole("option", { name: /tree/i });
      await treeOption.waitFor({
        state: "visible",
        timeout: Timeouts.animation,
      });
      await treeOption.click();
      // Close the options sheet so tree items are interactable
      await this.page.keyboard.press("Escape");
      await this.page
        .getByRole("dialog", { name: /view options/i })
        .waitFor({ state: "hidden", timeout: Timeouts.animation });
    } else {
      // After selecting a Radix DropdownMenu item, the close animation and
      // React re-render can leave Radix internal state desynchronised.
      // Retry with Escape resets to handle stale state.
      const trigger = this.page.getByTestId("items-view-dropdown");
      const menuItem = this.page.getByRole("menuitemradio").first();

      // Retry click until Radix dropdown opens — handles stale state after re-renders
      await expect(async () => {
        await trigger.click();
        await expect(menuItem).toBeVisible({ timeout: 1_000 });
      }).toPass({ timeout: Timeouts.api });

      await this.page.getByRole("menuitemradio", { name: /tree/i }).click();
    }
  }

  // ── Collapse / Expand ────────────────────────────────────

  /** Collapse a tree item by clicking its collapse toggle. */
  async collapseItem(name: string) {
    const slug = slugify(name);
    const item = this.page.getByTestId(`item-tree-${slug}`);
    await item
      .getByRole("button", { name: "Collapse item", exact: true })
      .click();
    await expect(
      item.getByRole("button", { name: "Expand item", exact: true })
    ).toBeVisible({ timeout: Timeouts.animation });
  }

  /** Expand a tree item by clicking its expand toggle. */
  async expandItem(name: string) {
    const slug = slugify(name);
    const item = this.page.getByTestId(`item-tree-${slug}`);
    await item
      .getByRole("button", { name: "Expand item", exact: true })
      .click();
    await expect(
      item.getByRole("button", { name: "Collapse item", exact: true })
    ).toBeVisible({ timeout: Timeouts.animation });
  }

  // ── Hierarchy Assertions ─────────────────────────────────

  /**
   * Verify that a child item is nested under a parent in the tree view.
   * Only works on item detail pages (tree view).
   */
  async expectChildOf(childName: string, parentName: string) {
    const childSlug = slugify(childName);
    const parentSlug = slugify(parentName);

    await expect(this.page.getByTestId(`item-tree-${parentSlug}`)).toBeVisible({
      timeout: Timeouts.api,
    });
    await expect(this.page.getByTestId(`item-tree-${childSlug}`)).toBeVisible({
      timeout: Timeouts.api,
    });

    const isChild = await this.page.evaluate(
      ([parentTestId, childTestId]) => {
        const parent = document.querySelector(
          `[data-testid="${parentTestId}"]`
        );
        const child = document.querySelector(`[data-testid="${childTestId}"]`);
        if (!parent || !child) return false;

        const position = parent.compareDocumentPosition(child);
        const isFollowing = (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

        const parentPadding = parseFloat(getComputedStyle(parent).paddingLeft);
        const childPadding = parseFloat(getComputedStyle(child).paddingLeft);

        return isFollowing && childPadding > parentPadding;
      },
      [`item-tree-${parentSlug}`, `item-tree-${childSlug}`]
    );

    expect(isChild).toBe(true);
  }

  /**
   * Verify the nesting depth of an item in the tree.
   * Only works on item detail pages (tree view).
   */
  async expectItemDepth(name: string, depth: number) {
    const slug = slugify(name);
    const testId = `item-tree-${slug}`;

    await expect(this.page.getByTestId(testId)).toBeVisible({
      timeout: Timeouts.api,
    });

    const actualDepth = await this.page.evaluate(
      ([tid]) => {
        const item = document.querySelector(`[data-testid="${tid}"]`);
        if (!item) return -1;

        const paddingLeft = parseFloat(getComputedStyle(item).paddingLeft);
        if (paddingLeft === 0) return 0;

        const allItems = Array.from(
          document.querySelectorAll('[data-testid^="item-tree-"]')
        );
        let minNonZeroPadding = Infinity;
        for (const el of allItems) {
          const pl = parseFloat(getComputedStyle(el).paddingLeft);
          if (pl > 0 && pl < minNonZeroPadding) {
            minNonZeroPadding = pl;
          }
        }

        if (minNonZeroPadding === Infinity) return 0;
        return Math.round(paddingLeft / minNonZeroPadding);
      },
      [testId]
    );

    expect(actualDepth).toBe(depth);
  }

  // ── Item Interaction ─────────────────────────────────────

  /** Click an item to navigate into its detail view. */
  async clickItem(name: string) {
    const item = this.getItemLocator(name);
    await item.waitFor({ state: "visible", timeout: Timeouts.api });
    await item.click();
    // Wait for item detail page to load — hero-carousel is unreliable
    // because it's also visible on the profile page before navigation.
    await expect(this.page.getByTestId("item-detail-container")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Visibility Assertions ────────────────────────────────

  /** Expect an item to be visible in the tree or grid view. */
  async expectItemVisible(name: string) {
    const item = this.getItemLocator(name);
    await expect(item).toBeVisible({ timeout: Timeouts.api });
  }

  /** Expect an item to NOT be visible in either tree or grid view. */
  async expectItemNotVisible(name: string) {
    const slug = slugify(name);
    await expect(this.page.getByTestId(`item-tree-${slug}`)).not.toBeVisible({
      timeout: Timeouts.animation,
    });
    await expect(this.page.getByTestId(`item-card-${slug}`)).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }
}
