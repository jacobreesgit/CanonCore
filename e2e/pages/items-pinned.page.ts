/**
 * Page object for pinned items functionality.
 * Covers pinning/unpinning items via the more options menu.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";
import { getItemLocator, openItemMoreMenu } from "../config/item-locators";

export class ItemsPinnedPage {
  constructor(
    private page: Page,
    private username: string,
    private _isMobile: boolean
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

  // ── Pin / Unpin ──────────────────────────────────────────

  /** Pin an item via the more options menu. */
  async pinItem(name: string) {
    await this.openMoreMenu(name);
    await this.page.getByRole("menuitem", { name: "Pin to Sidebar" }).click();
  }

  /** Unpin an item via the more options menu. */
  async unpinItem(name: string) {
    await this.openMoreMenu(name);
    await this.page
      .getByRole("menuitem", { name: "Unpin from Sidebar" })
      .click();
  }

  // ── Assertions ─────────────────────────────────────────

  /** Expect the item to appear in the "Pinned items" region. */
  async expectPinned(name: string) {
    const pinnedRegion = this.page.getByRole("region", {
      name: "Pinned items",
    });
    await expect(pinnedRegion.getByRole("heading", { name })).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /** Expect the item NOT to appear in the "Pinned items" region (or region absent). */
  async expectNotPinned(name: string) {
    const pinnedRegion = this.page.getByRole("region", {
      name: "Pinned items",
    });
    await expect(pinnedRegion.getByRole("heading", { name })).not.toBeVisible({
      timeout: Timeouts.api,
    });
  }
}
