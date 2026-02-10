/**
 * E2E tests for the mobile discard changes alert.
 * When a mobile sheet has unsaved changes and the user tries to dismiss it,
 * a confirmation alert appears with "Keep Editing" and "Discard" options.
 * Mobile only — desktop uses dialogs that don't have this pattern.
 */

import { test, expect } from "../../fixtures";

test.describe("Discard Changes Alert (Mobile)", () => {
  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, {
      timeout: 10000,
    });
    await itemsPage.createItem("Alert Test Item");
  });

  test("shows discard alert when dismissing sheet with unsaved changes", async ({
    page,
    itemsPage,
    isMobile,
  }) => {
    test.skip(!isMobile, "Discard changes alert is mobile-only");

    // Navigate to item detail to access the Options sheet
    await itemsPage.clickItem("Alert Test Item");
    // clickItem() already waits for hero + Add button to be visible

    // Open the mobile item options sheet
    await itemsPage.openMobileOptionsSheet();

    // Make a change (dirty the form)
    const container = page.getByRole("dialog", { name: /item options/i });
    await container.getByLabel(/item name/i).fill("Modified Name");

    // Try to dismiss the sheet by clicking the overlay
    const overlay = page.locator("[data-vaul-overlay]");
    await overlay.click({ force: true, position: { x: 10, y: 10 } });

    // Discard alert should appear
    const alert = page.getByTestId("discard-changes-alert");
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText("Discard unsaved changes?");
    await expect(
      alert.getByRole("button", { name: "Keep Editing" })
    ).toBeVisible();
    await expect(alert.getByRole("button", { name: "Discard" })).toBeVisible();
  });

  test("Keep Editing returns to sheet with changes preserved", async ({
    page,
    itemsPage,
    isMobile,
  }) => {
    test.skip(!isMobile, "Discard changes alert is mobile-only");

    await itemsPage.clickItem("Alert Test Item");
    // clickItem() already waits for hero + Add button to be visible
    await itemsPage.openMobileOptionsSheet();

    // Modify the name
    const container = page.getByRole("dialog", { name: /item options/i });
    await container.getByLabel(/item name/i).fill("Modified Name");

    // Dismiss to trigger alert
    const overlay = page.locator("[data-vaul-overlay]");
    await overlay.click({ force: true, position: { x: 10, y: 10 } });

    // Click "Keep Editing"
    const alert = page.getByTestId("discard-changes-alert");
    await expect(alert).toBeVisible({ timeout: 5000 });
    await alert.getByRole("button", { name: "Keep Editing" }).click();

    // Alert should close, sheet should still be open with the modified value
    await expect(alert).not.toBeVisible({ timeout: 3000 });
    await expect(container).toBeVisible();
    await expect(container.getByLabel(/item name/i)).toHaveValue(
      "Modified Name"
    );
  });

  test("Discard closes sheet and reverts changes", async ({
    page,
    itemsPage,
    isMobile,
  }) => {
    test.skip(!isMobile, "Discard changes alert is mobile-only");

    await itemsPage.clickItem("Alert Test Item");
    // clickItem() already waits for hero + Add button to be visible
    await itemsPage.openMobileOptionsSheet();

    // Modify the name
    const container = page.getByRole("dialog", { name: /item options/i });
    await container.getByLabel(/item name/i).fill("Modified Name");

    // Dismiss to trigger alert
    const overlay = page.locator("[data-vaul-overlay]");
    await overlay.click({ force: true, position: { x: 10, y: 10 } });

    // Click "Discard"
    const alert = page.getByTestId("discard-changes-alert");
    await expect(alert).toBeVisible({ timeout: 5000 });
    await alert.getByRole("button", { name: "Discard" }).click();

    // Both alert and sheet should close
    await expect(alert).not.toBeVisible({ timeout: 3000 });
    await expect(container).not.toBeVisible({ timeout: 5000 });

    // Item name should be unchanged
    await expect(
      page.getByRole("heading", { level: 1, name: "Alert Test Item" })
    ).toBeVisible();
  });
});
