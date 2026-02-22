/**
 * Google OAuth verification demo — split into two videos.
 *
 * Part 1: Sign up new user → settings → click "Connect Google Drive"
 *   (you manually record the Google OAuth consent screen)
 * Part 2: Shows connected state → sync → storage → items → streaming → disconnect → privacy policy
 *
 * Run:
 *   npx playwright test --config e2e/demo/playwright.demo.config.ts -g "Part 1"
 *   (manually complete OAuth in the browser, then:)
 *   npx playwright test --config e2e/demo/playwright.demo.config.ts -g "Part 2"
 *
 * Videos saved to test-results/ as .webm
 */
import { test, expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

/** Demo account credentials — used by both parts. */
const DEMO_USER = {
  email: "oauth-demo@canoncore.test",
  password: "DemoPassword123!",
  username: "oauth_demo",
};

/** Pause for narration. */
const narrate = (ms = 3000) => new Promise((r) => setTimeout(r, ms));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Part 1: Sign up → Connect Google Drive
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test("Part 1 — Sign up and initiate OAuth", async ({ page }) => {
  // ─── 1. Landing page ─────────────────────────────────────
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await narrate(4000);

  // ─── 2. Sign up ──────────────────────────────────────────
  await page.goto("/sign-up");
  await page
    .getByTestId("sign-up-email-input")
    .waitFor({ state: "visible", timeout: Timeouts.upload });
  await narrate(2000);

  await page.getByTestId("sign-up-email-input").fill(DEMO_USER.email);
  await narrate(1000);
  await page.getByTestId("sign-up-username-input").fill(DEMO_USER.username);
  await narrate(1000);
  await page.getByTestId("sign-up-password-input").fill(DEMO_USER.password);
  await narrate(1000);
  await page
    .getByTestId("sign-up-confirm-password-input")
    .fill(DEMO_USER.password);
  await narrate(1000);
  await page.getByTestId("sign-up-submit-button").click();

  // Auto sign-in redirects to /u/{username}
  await page.waitForURL(`/u/${DEMO_USER.username}`, {
    timeout: Timeouts.heavy,
  });
  await narrate(3000);

  // ─── 3. Open settings → Connections ──────────────────────
  const sidebar = page.getByTestId("nav-sidebar");
  if (!(await sidebar.isVisible())) {
    await page.getByTestId("sidebar-trigger").click();
    await expect(sidebar).toBeVisible({ timeout: Timeouts.animation });
  }
  await page.getByTestId("my-items-user-menu").click();
  await narrate(1500);
  await page.getByTestId("my-items-settings-button").click();
  await expect(page.getByTestId("dialog-settings")).toBeVisible({
    timeout: Timeouts.api,
  });
  await narrate(2000);

  await page.getByTestId("settings-tab-connections").click();
  await narrate(3000);

  // ─── 4. Click "Connect Google Drive" ─────────────────────
  const connectButton = page.getByRole("button", {
    name: "Connect Google Drive",
  });
  await expect(connectButton).toBeVisible({ timeout: Timeouts.api });
  await narrate(2000);

  await connectButton.click();
  await narrate(2000);

  // Video ends — Google OAuth redirect happens.
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Part 2: After OAuth — Drive features walkthrough
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

test("Part 2 — Drive features walkthrough", async ({ page }) => {
  // ─── 1. Sign in ──────────────────────────────────────────
  await page.goto("/sign-in");
  await page
    .getByTestId("sign-in-email-input")
    .waitFor({ state: "visible", timeout: Timeouts.upload });

  await page.getByTestId("sign-in-email-input").fill(DEMO_USER.email);
  await narrate(1000);
  await page.getByTestId("sign-in-password-input").fill(DEMO_USER.password);
  await narrate(1000);
  await page.getByTestId("sign-in-submit-button").click();
  await page.waitForURL(/\/u\//, { timeout: Timeouts.upload });
  await narrate(3000);

  // ─── 2. Settings → Connections (now connected) ───────────
  const sidebar = page.getByTestId("nav-sidebar");
  if (!(await sidebar.isVisible())) {
    await page.getByTestId("sidebar-trigger").click();
    await expect(sidebar).toBeVisible({ timeout: Timeouts.animation });
  }
  await page.getByTestId("my-items-user-menu").click();
  await narrate(1500);
  await page.getByTestId("my-items-settings-button").click();
  await expect(page.getByTestId("dialog-settings")).toBeVisible({
    timeout: Timeouts.api,
  });
  await narrate(2000);

  await page.getByTestId("settings-tab-connections").click();
  await narrate(4000);

  // ─── 3. Trigger a sync ───────────────────────────────────
  const syncButton = page.getByRole("button", { name: "Sync" });
  if (await syncButton.isEnabled()) {
    await syncButton.click();
    await page
      .getByText(/sync/i)
      .first()
      .waitFor({ state: "visible", timeout: Timeouts.upload })
      .catch(() => {});
    await narrate(3000);
  }

  // ─── 4. Show "Open in Drive" link ────────────────────────
  const driveLink = page.getByRole("link", { name: "Drive" });
  if (await driveLink.isVisible()) {
    await driveLink.hover();
    await narrate(3000);
  }

  // ─── 5. Close settings, show items ───────────────────────
  await page.mouse.click(10, 10);
  await expect(page.getByTestId("dialog-settings")).not.toBeVisible({
    timeout: Timeouts.api,
  });
  await narrate(4000);

  // ─── 6. Create a new item (folder creation in Drive) ─────
  await page.getByTestId("items-add-button").click();
  const nameInput = page.getByRole("combobox", { name: /item name/i });
  await nameInput.waitFor({ state: "visible", timeout: Timeouts.api });
  await nameInput.fill("Demo Movie");
  await nameInput.press("Escape");
  await narrate(2000);

  const createButton = page.getByRole("button", { name: /create/i });
  await createButton.click();
  await narrate(3000);

  // ─── 7. Click into item detail ───────────────────────────
  const itemCard = page.locator("[data-testid^='item-card-']").first();
  if (await itemCard.isVisible()) {
    await itemCard.click();
    await page.waitForLoadState("domcontentloaded");
    await narrate(4000);

    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await narrate(2000);
  }

  // ─── 8. Show disconnect flow ─────────────────────────────
  await page.getByTestId("my-items-user-menu").click();
  await narrate(1000);
  await page.getByTestId("my-items-settings-button").click();
  await expect(page.getByTestId("dialog-settings")).toBeVisible({
    timeout: Timeouts.api,
  });
  await page.getByTestId("settings-tab-connections").click();
  await narrate(2000);

  const disconnectButton = page.getByRole("button", { name: "Disconnect" });
  await disconnectButton.click();
  await narrate(3000);

  await expect(page.getByText("Disconnect Google Drive?")).toBeVisible();
  await narrate(3000);

  await page.getByRole("button", { name: "Cancel" }).click();
  await narrate(2000);

  // ─── 9. Account tab → data export & deletion ─────────────
  await page.getByTestId("settings-tab-account").click();
  await narrate(4000);

  const settingsContent = page.getByTestId("dialog-settings");
  await settingsContent.evaluate((el) => {
    const scrollable = el.querySelector("[data-radix-scroll-area-viewport]");
    scrollable?.scrollTo({ top: scrollable.scrollHeight, behavior: "smooth" });
  });
  await narrate(4000);

  // ─── 10. Privacy policy → Google API section ─────────────
  await page.keyboard.press("Escape");
  await narrate(1000);

  await page.goto("/legal/privacy-policy");
  await page.waitForLoadState("networkidle");
  await narrate(3000);

  const googleApiLink = page.getByRole("link", {
    name: "Google API",
    exact: true,
  });
  if (await googleApiLink.isVisible()) {
    await googleApiLink.scrollIntoViewIfNeeded();
    await narrate(4000);
  }

  await narrate(3000);
});
