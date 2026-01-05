/**
 * Page Object Model for SFTP Connections pages.
 * Provides methods for interacting with connection management UI.
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class ConnectionsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly addConnectionButton: Locator;
  readonly emptyState: Locator;
  readonly connectionCards: Locator;

  // Form elements
  readonly nameInput: Locator;
  readonly hostInput: Locator;
  readonly portInput: Locator;
  readonly usernameInput: Locator;
  readonly authTypeSelect: Locator;
  readonly credentialInput: Locator;
  readonly basePathInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "SFTP Connections" });
    this.addConnectionButton = page.getByRole("link", {
      name: /add.*connection/i,
    });
    this.emptyState = page.getByText("No connections yet");
    this.connectionCards = page.locator('[data-slot="card"]');

    // Form elements
    this.nameInput = page.getByLabel("Connection Name");
    this.hostInput = page.getByLabel("Host");
    this.portInput = page.getByLabel("Port");
    this.usernameInput = page.getByLabel("Username");
    this.authTypeSelect = page.getByRole("combobox");
    this.credentialInput = page.getByLabel(/password|private key/i);
    this.basePathInput = page.getByLabel("Base Path");
    this.submitButton = page.getByRole("button", {
      name: /create connection|save changes/i,
    });
    this.cancelButton = page.getByRole("button", { name: "Cancel" });
  }

  /** Navigate to connections list page. */
  async goto() {
    await this.page.goto("/dashboard/connections");
  }

  /** Navigate to new connection page. */
  async gotoNew() {
    await this.page.goto("/dashboard/connections/new");
  }

  /** Navigate to edit connection page. */
  async gotoEdit(connectionId: string) {
    await this.page.goto(`/dashboard/connections/${connectionId}/edit`);
  }

  /** Verify the list page is loaded. */
  async expectListPage() {
    await expect(this.heading).toBeVisible();
  }

  /** Verify empty state is shown. */
  async expectEmptyState() {
    await expect(this.emptyState).toBeVisible();
  }

  /** Verify connection cards are visible. */
  async expectConnectionCards(count: number) {
    await expect(this.connectionCards).toHaveCount(count);
  }

  /** Click the add connection button. */
  async clickAddConnection() {
    await this.addConnectionButton.click();
  }

  /** Fill connection form with provided data. */
  async fillConnectionForm(data: {
    name: string;
    host: string;
    port?: number;
    username: string;
    authType?: "PASSWORD" | "PRIVATE_KEY";
    credential: string;
    basePath?: string;
  }) {
    await this.nameInput.fill(data.name);
    await this.hostInput.fill(data.host);
    if (data.port) {
      await this.portInput.fill(data.port.toString());
    }
    await this.usernameInput.fill(data.username);
    if (data.authType) {
      await this.authTypeSelect.click();
      await this.page
        .getByRole("option", {
          name: data.authType === "PASSWORD" ? "Password" : "SSH Private Key",
        })
        .click();
    }
    // Re-locate credential input after auth type change
    const credLabel =
      data.authType === "PRIVATE_KEY" ? "Private Key" : "Password";
    await this.page.getByLabel(credLabel).fill(data.credential);
    if (data.basePath) {
      await this.basePathInput.fill(data.basePath);
    }
  }

  /** Submit the connection form. */
  async submitForm() {
    await this.submitButton.click();
  }

  /** Cancel the form. */
  async cancelForm() {
    await this.cancelButton.click();
  }

  /** Get connection card by name. */
  getConnectionCard(name: string): Locator {
    return this.connectionCards.filter({ hasText: name });
  }

  /** Open actions menu for a connection. */
  async openConnectionActions(name: string) {
    const card = this.getConnectionCard(name);
    await card.hover();
    await card.getByRole("button", { name: "Connection actions" }).click();
  }

  /** Click test button on a connection card. */
  async testConnection(name: string) {
    const card = this.getConnectionCard(name);
    await card.getByRole("button", { name: "Test" }).click();
  }

  /** Delete a connection via the actions menu. */
  async deleteConnection(name: string) {
    await this.openConnectionActions(name);

    // Handle confirmation dialog
    this.page.once("dialog", (dialog) => dialog.accept());

    await this.page.getByRole("menuitem", { name: "Delete" }).click();
  }

  /** Edit a connection via the actions menu. */
  async editConnection(name: string) {
    await this.openConnectionActions(name);
    await this.page.getByRole("menuitem", { name: "Edit" }).click();
  }

  /** Expect a toast message. */
  async expectToast(message: string | RegExp) {
    await expect(this.page.getByText(message)).toBeVisible();
  }
}
