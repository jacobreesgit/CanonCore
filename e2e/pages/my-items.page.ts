/**
 * Page object for my-items page.
 * Provides methods for user menu interactions and sign-out.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class MyItemsPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly userMenu: Locator;
  readonly signOutButton: Locator;
  readonly profileSettingsButton: Locator;
  readonly sidebarTrigger: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.getByTestId("my-items-welcome-message");
    this.userMenu = page.getByTestId("my-items-user-menu");
    this.signOutButton = page.getByTestId("my-items-sign-out-button");
    this.profileSettingsButton = page.getByTestId("my-items-settings-button");
    this.sidebarTrigger = page.getByTestId("sidebar-trigger");
  }

  async goto() {
    await this.page.goto("/my-items");
  }

  async openUserMenu() {
    // On mobile, sidebar is collapsed - need to open it first
    const isUserMenuVisible = await this.userMenu.isVisible();
    if (!isUserMenuVisible) {
      await this.sidebarTrigger.click();
      await this.userMenu.waitFor({ state: "visible", timeout: 5000 });
    }
    await this.userMenu.click();
    // Wait for dropdown to open
    await this.signOutButton.waitFor({ state: "visible", timeout: 5000 });
  }

  async signOut() {
    await this.openUserMenu();
    await this.signOutButton.click();
  }

  async openProfileSettings() {
    await this.openUserMenu();
    await this.profileSettingsButton.click();
  }

  async expectVisible() {
    await expect(this.page).toHaveURL("/my-items");
  }
}
