import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly userMenu: Locator;
  readonly signOutButton: Locator;
  readonly sidebarTrigger: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.getByTestId("dashboard-welcome-message");
    this.userMenu = page.getByTestId("dashboard-user-menu");
    this.signOutButton = page.getByTestId("dashboard-sign-out-button");
    this.sidebarTrigger = page.getByTestId("sidebar-trigger");
  }

  async goto() {
    await this.page.goto("/dashboard");
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

  async expectVisible() {
    await expect(this.page).toHaveURL("/dashboard");
  }
}
