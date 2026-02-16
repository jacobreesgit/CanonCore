/**
 * Page object for navigation elements.
 * Covers sidebar, header, mobile footer, skip link.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class NavPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Navigation ──────────────────────────────────────────

  /** Navigate to the user's items page. */
  async gotoMyItems() {
    await this.page.goto(`/u/${this.username}`);
  }

  // ── Desktop Sidebar ─────────────────────────────────────

  /** Open sidebar if closed (desktop only). */
  async openSidebar() {
    const sidebar = this.page.getByTestId("nav-sidebar");
    if (!(await sidebar.isVisible())) {
      await this.page.getByTestId("sidebar-trigger").click();
      await expect(sidebar).toBeVisible({ timeout: Timeouts.animation });
    }
  }

  /** Close sidebar if open (desktop only). */
  async closeSidebar() {
    const sidebar = this.page.getByTestId("nav-sidebar");
    if (await sidebar.isVisible()) {
      await this.page.getByTestId("sidebar-trigger").click();
      await expect(sidebar).not.toBeVisible({ timeout: Timeouts.animation });
    }
  }

  /** Open user menu dropdown (desktop). */
  async openUserMenuDesktop() {
    await this.openSidebar();
    await this.page.getByTestId("my-items-user-menu").click();
  }

  /** Sign out via desktop sidebar. */
  async signOutDesktop() {
    await this.openUserMenuDesktop();
    await this.page.getByTestId("my-items-sign-out-button").click();
  }

  /** Open settings via desktop sidebar. */
  async openSettingsDesktop() {
    await this.openUserMenuDesktop();
    await this.page.getByTestId("my-items-settings-button").click();
  }

  // ── Mobile Footer ───────────────────────────────────────

  /** Navigate to My Items via mobile footer. */
  async tapMyItemsMobile() {
    await this.page.getByTestId("nav-mobile-my-items").click();
  }

  /** Navigate to Explore via mobile footer. */
  async tapExploreMobile() {
    await this.page.getByTestId("nav-mobile-explore").click();
  }

  /** Open account/settings sheet via mobile footer. */
  async tapAccountMobile() {
    await this.page.getByTestId("nav-mobile-account").click();
    await expect(this.page.getByTestId("sheet-settings")).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /** Sign out via mobile settings sheet. */
  async signOutMobile() {
    await this.tapAccountMobile();
    // Navigate to Account tab via select dropdown
    const selectTrigger = this.page.getByTestId("settings-tab-select");
    await selectTrigger.click();
    await this.page.getByTestId("settings-tab-option-account").click();
    await this.page.getByTestId("settings-sign-out-button").click();
  }

  // ── Convenience ─────────────────────────────────────────

  /** Sign out (dispatches to mobile or desktop). */
  async signOut() {
    if (this.isMobile) {
      await this.signOutMobile();
    } else {
      await this.signOutDesktop();
    }
  }

  // ── Header ──────────────────────────────────────────────

  /** Scroll to top to reveal auto-hiding header. */
  async revealHeader() {
    await this.page.evaluate(() => {
      const main = document.getElementById("main-content");
      (main ?? window).scrollTo(0, 0);
    });
    await expect(this.page.getByTestId("nav-breadcrumb")).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /** Click a breadcrumb link. */
  async clickBreadcrumb(name: string) {
    await this.revealHeader();
    await this.page
      .getByTestId("nav-breadcrumb")
      .getByRole("link", { name, exact: true })
      .click();
  }

  /** Expect breadcrumb with given name is visible. */
  async expectBreadcrumb(name: string) {
    await this.revealHeader();
    await expect(
      this.page
        .getByTestId("nav-breadcrumb")
        .getByRole("link", { name, exact: true })
    ).toBeVisible({ timeout: Timeouts.api });
  }

  // ── Skip Link ───────────────────────────────────────────

  /** Tab to skip link and activate it. */
  async useSkipLink() {
    await this.page.keyboard.press("Tab");
    await this.page.keyboard.press("Enter");
  }
}
