/**
 * Page object for mobile footer navigation interactions.
 * Provides methods for interacting with the mobile footer nav and bottom sheets.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Page object for mobile footer navigation.
 * Use this for mobile E2E tests instead of sidebar interactions.
 */
export class MobileFooterPage {
  constructor(private page: Page) {}

  // === FOOTER NAVIGATION ===

  /** The footer navigation container. */
  get footer() {
    return this.page.getByRole("navigation", { name: /mobile navigation/i });
  }

  /** My Items navigation button (authenticated users). */
  get myItemsButton() {
    return this.footer.getByRole("link", { name: /my items/i });
  }

  /** Explore navigation button. */
  get exploreButton() {
    return this.footer.getByRole("link", { name: /explore/i });
  }

  /** Search sheet trigger button. */
  get searchButton() {
    return this.footer.getByRole("button", { name: /search/i });
  }

  /** Help sheet trigger button. */
  get helpButton() {
    return this.footer.getByRole("button", { name: /help/i });
  }

  /** Account/User sheet trigger button (authenticated users). */
  get accountButton() {
    return this.footer.getByRole("button", { name: /account/i });
  }

  /** Settings sheet trigger button (guest users). */
  get settingsButton() {
    return this.footer.getByRole("button", { name: /settings/i });
  }

  /** Sign In navigation button (guest users). */
  get signInButton() {
    return this.footer.getByRole("link", { name: /sign in/i });
  }

  // === BOTTOM SHEETS ===

  /** Search bottom sheet dialog. */
  get searchSheet() {
    return this.page.getByRole("dialog", { name: /search/i });
  }

  /** User/Account bottom sheet dialog (now opens Settings directly). */
  get userSheet() {
    return this.page.getByRole("dialog", { name: /settings/i });
  }

  /** Help bottom sheet dialog. */
  get helpSheet() {
    return this.page.getByRole("dialog", { name: /get help/i });
  }

  /** Settings bottom sheet dialog (guest users). */
  get settingsSheet() {
    return this.page.getByRole("dialog", { name: /settings/i });
  }

  /** Any currently open sheet. */
  get anySheet() {
    return this.page.getByRole("dialog");
  }

  // === NAVIGATION ACTIONS ===

  /**
   * Navigates to My Items via footer nav.
   */
  async navigateToMyItems(): Promise<void> {
    await this.myItemsButton.click();
  }

  /**
   * Navigates to Explore via footer nav.
   */
  async navigateToExplore(): Promise<void> {
    await this.exploreButton.click();
  }

  /**
   * Navigates to Sign In page via footer nav.
   */
  async navigateToSignIn(): Promise<void> {
    await this.signInButton.click();
  }

  // === SHEET ACTIONS ===

  /**
   * Opens the search bottom sheet.
   */
  async openSearchSheet(): Promise<void> {
    await this.searchButton.click();
    await expect(this.searchSheet).toBeVisible();
  }

  /**
   * Opens the help bottom sheet.
   */
  async openHelpSheet(): Promise<void> {
    await this.helpButton.click();
    await expect(this.helpSheet).toBeVisible();
  }

  /**
   * Opens the user/account bottom sheet.
   */
  async openUserSheet(): Promise<void> {
    await this.accountButton.click();
    await expect(this.userSheet).toBeVisible();
  }

  /**
   * Opens the settings bottom sheet (guest users).
   */
  async openSettingsSheet(): Promise<void> {
    await this.settingsButton.click();
    await expect(this.settingsSheet).toBeVisible();
  }

  /**
   * Closes any open bottom sheet via Escape key.
   */
  async closeSheet(): Promise<void> {
    if (await this.anySheet.isVisible()) {
      await this.page.keyboard.press("Escape");
      await expect(this.anySheet).not.toBeVisible();
    }
  }

  /**
   * Closes any open bottom sheet by tapping the overlay backdrop.
   */
  async closeSheetByBackdrop(): Promise<void> {
    const overlay = this.page.locator("[data-vaul-overlay]");
    if (await overlay.isVisible()) {
      // Click in the top-left corner which should be outside the sheet
      await overlay.click({ position: { x: 10, y: 10 } });
      await expect(this.anySheet).not.toBeVisible();
    }
  }

  // === USER SHEET ACTIONS ===

  /** Sign out button in settings sheet Account tab. */
  get signOutButton() {
    return this.userSheet.getByRole("button", { name: /sign out/i });
  }

  /**
   * Signs out via the settings sheet Account tab.
   */
  async signOut(): Promise<void> {
    await this.openUserSheet();
    await this.page.getByRole("tab", { name: /account/i }).click();
    await this.signOutButton.click();
  }

  /**
   * Opens settings sheet (Account button now opens settings directly).
   */
  async openSettingsFromUserSheet(): Promise<void> {
    await this.openUserSheet();
  }

  // === HELP SHEET ACTIONS ===

  /**
   * Clicks a documentation link in the help sheet.
   *
   * @param linkText - Text of the documentation link to click
   */
  async clickHelpLink(linkText: string): Promise<void> {
    await this.helpSheet
      .getByRole("link", { name: new RegExp(linkText, "i") })
      .click();
  }

  // === ASSERTIONS ===

  /**
   * Asserts that the footer is visible (mobile viewport).
   */
  async expectFooterVisible(): Promise<void> {
    await expect(this.footer).toBeVisible();
  }

  /**
   * Asserts that the footer is not visible (desktop viewport).
   */
  async expectFooterHidden(): Promise<void> {
    await expect(this.footer).not.toBeVisible();
  }

  /**
   * Asserts that a specific nav item is active.
   *
   * @param itemName - Name of the item (e.g., "My Items", "Explore")
   */
  async expectNavItemActive(itemName: string): Promise<void> {
    const item = this.footer.getByRole("link", {
      name: new RegExp(itemName, "i"),
    });
    await expect(item).toHaveAttribute("aria-current", "page");
  }

  /**
   * Asserts that no sheet is currently open.
   */
  async expectNoSheetOpen(): Promise<void> {
    await expect(this.anySheet).not.toBeVisible();
  }

  /**
   * Checks if the footer shows authenticated user items.
   */
  async expectAuthenticatedFooter(): Promise<void> {
    await expect(this.myItemsButton).toBeVisible();
    await expect(this.searchButton).toBeVisible();
    await expect(this.accountButton).toBeVisible();
    await expect(this.signInButton).not.toBeVisible();
  }

  /**
   * Checks if the footer shows guest user items.
   */
  async expectGuestFooter(): Promise<void> {
    await expect(this.myItemsButton).not.toBeVisible();
    await expect(this.searchButton).toBeVisible();
    await expect(this.signInButton).toBeVisible();
    await expect(this.settingsButton).toBeVisible();
  }
}
