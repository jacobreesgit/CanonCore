/**
 * Page object for user profile page.
 * Provides methods for user menu interactions and sign-out.
 * Handles both desktop (sidebar) and mobile (footer sheet) navigation.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  isMobileViewport,
  openUserSheetIfClosed,
  signOutViaMobile,
  openSettingsViaMobile,
} from "../helpers/mobile-nav-helpers";

export class MyItemsPage {
  readonly page: Page;
  private username: string;
  readonly userMenu: Locator;
  readonly signOutButton: Locator;
  readonly profileSettingsButton: Locator;
  readonly sidebarTrigger: Locator;

  constructor(page: Page, username: string) {
    this.page = page;
    this.username = username;
    this.userMenu = page.getByTestId("my-items-user-menu");
    this.signOutButton = page.getByTestId("my-items-sign-out-button");
    this.profileSettingsButton = page.getByTestId("my-items-settings-button");
    this.sidebarTrigger = page.getByTestId("sidebar-trigger");
  }

  async goto() {
    await this.page.goto(`/u/${this.username}`);
  }

  /**
   * Checks if we're on a mobile viewport.
   */
  private async isMobile(): Promise<boolean> {
    return isMobileViewport(this.page);
  }

  /**
   * Opens the user menu (desktop) or user sheet (mobile).
   */
  async openUserMenu() {
    if (await this.isMobile()) {
      // Mobile: Open account sheet via footer nav
      await openUserSheetIfClosed(this.page);
    } else {
      // Desktop: Open sidebar if collapsed, then user menu dropdown
      const isUserMenuVisible = await this.userMenu.isVisible();
      if (!isUserMenuVisible) {
        await this.sidebarTrigger.click();
        await this.userMenu.waitFor({ state: "visible", timeout: 5000 });
      }
      await this.userMenu.click();
      // Wait for dropdown to open
      await this.signOutButton.waitFor({ state: "visible", timeout: 5000 });
    }
  }

  /**
   * Signs out the current user.
   */
  async signOut() {
    if (await this.isMobile()) {
      // Mobile: Use footer nav → account sheet → sign out
      await signOutViaMobile(this.page);
    } else {
      // Desktop: Use sidebar user menu dropdown
      await this.openUserMenu();
      await this.signOutButton.click();
    }
  }

  /**
   * Opens profile settings dialog.
   */
  async openProfileSettings() {
    if (await this.isMobile()) {
      // Mobile: Open account sheet → settings button → settings dialog
      await openSettingsViaMobile(this.page);
    } else {
      // Desktop: User menu → settings button
      await this.openUserMenu();
      await this.profileSettingsButton.click();
    }
  }

  async expectVisible() {
    await expect(this.page).toHaveURL(`/u/${this.username}`);
  }
}
