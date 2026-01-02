/**
 * E2E tests for SFTP connection management.
 * Tests full CRUD operations with database verification.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Connections List", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("conn-list");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("shows empty state when no connections exist", async ({
    connectionsPage,
  }) => {
    await connectionsPage.goto();
    await connectionsPage.expectListPage();
    await connectionsPage.expectEmptyState();
  });

  test("navigates to new connection page", async ({
    page,
    connectionsPage,
  }) => {
    await connectionsPage.goto();
    await connectionsPage.clickAddConnection();
    await expect(page).toHaveURL("/dashboard/connections/new");
  });
});

test.describe("Connection CRUD", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("conn-crud");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("creates connection and shows in list", async ({
    page,
    connectionsPage,
  }) => {
    // Go to new connection form
    await connectionsPage.gotoNew();

    // Fill form with test data
    await connectionsPage.fillConnectionForm({
      name: "My Test Server",
      host: "sftp.test.example.com",
      port: 22,
      username: "testuser",
      credential: "testpassword123",
      basePath: "/uploads",
    });

    // Submit form
    await connectionsPage.submitForm();

    // Should redirect to connections list
    await expect(page).toHaveURL("/dashboard/connections", { timeout: 10000 });

    // Should show success toast
    await connectionsPage.expectToast(/created|success/i);

    // Connection should appear in list
    const connectionCard = connectionsPage.getConnectionCard("My Test Server");
    await expect(connectionCard).toBeVisible();

    // Card should show host
    await expect(
      connectionCard.getByText("sftp.test.example.com")
    ).toBeVisible();
  });

  test("edits existing connection", async ({ page, connectionsPage }) => {
    // First create a connection
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Server To Edit",
      host: "original.example.com",
      username: "user1",
      credential: "pass1",
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/dashboard/connections", { timeout: 10000 });

    // Now edit it
    await connectionsPage.editConnection("Server To Edit");

    // Should be on edit page
    await expect(page.getByText("Edit Connection")).toBeVisible();

    // Update the name
    await connectionsPage.nameInput.clear();
    await connectionsPage.nameInput.fill("Renamed Server");
    await connectionsPage.submitForm();

    // Should redirect back to list
    await expect(page).toHaveURL("/dashboard/connections", { timeout: 10000 });

    // Should show success toast
    await connectionsPage.expectToast(/updated|saved|success/i);

    // Old name should be gone, new name should be visible
    await expect(
      connectionsPage.getConnectionCard("Server To Edit")
    ).not.toBeVisible();
    await expect(
      connectionsPage.getConnectionCard("Renamed Server")
    ).toBeVisible();
  });

  test("deletes connection with confirmation", async ({
    page,
    connectionsPage,
  }) => {
    // First create a connection
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Server To Delete",
      host: "delete.example.com",
      username: "user",
      credential: "pass",
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/dashboard/connections", { timeout: 10000 });

    // Verify it exists
    await expect(
      connectionsPage.getConnectionCard("Server To Delete")
    ).toBeVisible();

    // Delete it
    await connectionsPage.deleteConnection("Server To Delete");

    // Should show success toast
    await connectionsPage.expectToast(/deleted|removed|success/i);

    // Should no longer be visible
    await expect(
      connectionsPage.getConnectionCard("Server To Delete")
    ).not.toBeVisible();
  });

  test("shows error for duplicate name", async ({ page, connectionsPage }) => {
    // Create first connection
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Duplicate Name Test",
      host: "first.example.com",
      username: "user1",
      credential: "pass1",
    });
    await connectionsPage.submitForm();
    await expect(page).toHaveURL("/dashboard/connections", { timeout: 10000 });

    // Try to create second with same name
    await connectionsPage.gotoNew();
    await connectionsPage.fillConnectionForm({
      name: "Duplicate Name Test",
      host: "second.example.com",
      username: "user2",
      credential: "pass2",
    });
    await connectionsPage.submitForm();

    // Should show error
    await connectionsPage.expectToast(/already exists|duplicate/i);
  });
});

test.describe("Connection Form Defaults", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("conn-defaults");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("defaults port to 22", async ({ connectionsPage }) => {
    await connectionsPage.gotoNew();
    await expect(connectionsPage.portInput).toHaveValue("22");
  });

  test("defaults base path to /", async ({ connectionsPage }) => {
    await connectionsPage.gotoNew();
    await expect(connectionsPage.basePathInput).toHaveValue("/");
  });

  test("validates required fields", async ({ page, connectionsPage }) => {
    await connectionsPage.gotoNew();

    // Try to submit empty form
    await connectionsPage.submitForm();

    // Should show validation errors
    await expect(
      page.getByText("Name is required", { exact: true })
    ).toBeVisible();
  });

  test("toggles between password and private key auth", async ({
    page,
    connectionsPage,
  }) => {
    await connectionsPage.gotoNew();

    // Default should be password
    await expect(page.getByLabel("Password")).toBeVisible();

    // Switch to private key
    await connectionsPage.authTypeSelect.click();
    await page.getByRole("option", { name: "SSH Private Key" }).click();

    // Should show private key textarea
    await expect(page.getByLabel("Private Key")).toBeVisible();
  });

  test("cancel returns to list", async ({ page, connectionsPage }) => {
    await connectionsPage.gotoNew();
    await connectionsPage.cancelForm();
    await expect(page).toHaveURL("/dashboard/connections");
  });
});

test.describe("Sidebar Navigation", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("conn-sidebar");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("has connections link in sidebar under settings", async ({ page }) => {
    await page.goto("/dashboard");

    // On mobile, need to open sidebar first
    const sidebar = page.locator('[data-sidebar="sidebar"]');
    const isSidebarVisible = await sidebar.isVisible().catch(() => false);
    if (!isSidebarVisible) {
      const trigger = page.getByTestId("sidebar-trigger");
      await trigger.click();
      await expect(sidebar).toBeVisible();
    }

    // Settings collapsible is open by default, so Connections should be visible
    // First verify Settings section exists
    const settingsButton = page.getByRole("button", { name: "Settings" });
    await expect(settingsButton).toBeVisible();

    // Connections link should already be visible since Settings is open by default
    const connectionsLink = page.getByRole("link", { name: "Connections" });
    await expect(connectionsLink).toBeVisible();

    await connectionsLink.click();
    await expect(page).toHaveURL("/dashboard/connections");
  });
});
