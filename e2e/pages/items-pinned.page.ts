/**
 * Page object for pinned items functionality.
 * Covers pinning/unpinning items via the more options menu and verifying
 * pinned item presence in the sidebar navigation.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";
import { slugify } from "../../lib/slugify";

export class ItemsPinnedPage {
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

  // ── Helpers ─────────────────────────────────────────────

  /**
   * Open the more options dropdown for an item.
   * The button is always in the DOM (opacity 0) so no hover needed.
   */
  private async openMoreMenu(name: string) {
    const slug = slugify(name);
    const moreButton = this.page.getByTestId(`item-more-${slug}`);
    await moreButton.click();
  }

  // ── Pin / Unpin ──────────────────────────────────────────

  /** Pin an item to the sidebar via the more options menu. */
  async pinItem(name: string) {
    await this.openMoreMenu(name);
    await this.page.getByRole("menuitem", { name: "Pin to Sidebar" }).click();
    await this.expectPinnedInSidebar(name);
  }

  /** Unpin an item from the sidebar via the more options menu. */
  async unpinItem(name: string) {
    await this.openMoreMenu(name);
    await this.page
      .getByRole("menuitem", { name: "Unpin from Sidebar" })
      .click();
    await this.expectNotPinnedInSidebar(name);
  }

  // ── Sidebar Assertions ───────────────────────────────────

  /** Expect the named item to appear in the sidebar pinned list. */
  async expectPinnedInSidebar(name: string) {
    const sidebar = this.page.getByTestId("nav-sidebar");
    await expect(sidebar.getByText(name, { exact: true })).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /** Expect the named item to NOT appear in the sidebar pinned list. */
  async expectNotPinnedInSidebar(name: string) {
    const sidebar = this.page.getByTestId("nav-sidebar");
    await expect(sidebar.getByText(name, { exact: true })).not.toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /** Click a pinned item link inside the sidebar to navigate to it. */
  async clickPinnedItem(name: string) {
    const sidebar = this.page.getByTestId("nav-sidebar");
    await sidebar.getByText(name, { exact: true }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Expect a specific number of pinned items in the sidebar.
   */
  async expectPinnedCount(count: number) {
    await expect
      .poll(
        async () => {
          return this.page.evaluate(() => {
            const sidebar = document.querySelector(
              '[data-testid="nav-sidebar"]'
            );
            if (!sidebar) return 0;
            return sidebar.querySelectorAll('[data-sidebar="menu-sub-button"]')
              .length;
          });
        },
        { timeout: Timeouts.api }
      )
      .toBe(count);
  }
}
