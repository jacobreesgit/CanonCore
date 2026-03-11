/**
 * Page object for the spotlight search dialog.
 * Covers opening, searching, selecting results, empty state,
 * and result counting across the three sections
 * (Your Items, Public Items, People).
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class SpotlightPage {
  constructor(
    private page: Page,
    private isMobile: boolean
  ) {}

  // ── Open / Close ──────────────────────────────────────

  /**
   * Open the spotlight dialog by pressing the "/" keyboard shortcut.
   * Waits for the dialog to become visible before returning.
   */
  async open() {
    await this.page.keyboard.press("/");
    await expect(this.page.getByTestId("spotlight-dialog")).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /**
   * Open the spotlight dialog via the navigation search button.
   * Desktop: clicks the sidebar search button (nav-search-button).
   * Mobile: clicks the mobile footer search button (nav-mobile-search).
   * Waits for the dialog to become visible before returning.
   */
  async openViaButton() {
    if (this.isMobile) {
      await this.page.getByTestId("nav-mobile-search").click();
    } else {
      await this.page.getByTestId("nav-search-button").click();
    }
    await expect(this.page.getByTestId("spotlight-dialog")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Close the spotlight dialog by pressing the Escape key.
   * Waits for the dialog to be hidden before returning.
   */
  async close() {
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByTestId("spotlight-dialog")).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  // ── Search ────────────────────────────────────────────

  /**
   * Type a search query into the spotlight input field.
   * Clears any existing text before filling.
   *
   * @param query - The search text to enter
   */
  async search(query: string) {
    const input = this.page.getByTestId("spotlight-input");
    await input.waitFor({ state: "visible", timeout: Timeouts.animation });
    await input.clear();
    await input.fill(query);
  }

  // ── Assertions ────────────────────────────────────────

  /** Assert that the spotlight dialog is visible. */
  async expectOpen() {
    await expect(this.page.getByTestId("spotlight-dialog")).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /** Assert that the spotlight dialog is not visible. */
  async expectClosed() {
    await expect(this.page.getByTestId("spotlight-dialog")).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /**
   * Assert that a search result with the given name is visible.
   * Searches for a matching option within the spotlight dialog's command list.
   *
   * @param name - The result text to look for
   */
  async expectResultVisible(name: string) {
    const dialog = this.page.getByTestId("spotlight-dialog");
    await expect(dialog.getByRole("option", { name })).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Assert that the empty state ("No results found.") is visible.
   * This appears when a search returns zero matches across all sections.
   */
  async expectNoResults() {
    const dialog = this.page.getByTestId("spotlight-dialog");
    await expect(dialog.getByText("No results found.")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Assert the number of visible results within a named section.
   * Sections are identified by their heading text
   * (e.g., "Your Items", "Public Items", "People").
   *
   * @param section - The section heading text
   * @param count - The expected number of results in that section
   */
  async expectResultCount(section: string, count: number) {
    const dialog = this.page.getByTestId("spotlight-dialog");
    const group = dialog.getByRole("group", { name: section });
    const options = group.getByRole("option");
    await expect(options).toHaveCount(count, { timeout: Timeouts.api });
  }

  // ── Interaction ───────────────────────────────────────

  /**
   * Click on a search result matching the given name.
   * Uses the option role within the spotlight dialog to find the result.
   *
   * @param name - The name of the result to select
   */
  async selectResult(name: string) {
    const dialog = this.page.getByTestId("spotlight-dialog");
    await dialog.getByRole("option", { name }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
