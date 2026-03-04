/**
 * LS Graphics interaction helpers for automated mockup generation.
 *
 * Flow per mockup:
 * 1. Navigate to scene page → click "Edit Online"
 * 2. Dismiss tutorial overlay (must happen BEFORE green screen click)
 * 3. Click green screen area → upload modal → Browse → file chooser
 * 4. Crop editor → Continue → image composites into mockup canvas
 * 5. Dismiss tutorial step 2 → Download
 *
 * IMPORTANT: Must run headed (headless: false). The LS Graphics editor uses
 * canvas/WebGL compositing that fails silently in headless Chrome — the image
 * uploads and crop work, but Continue never composites onto the canvas.
 */
import type { Page, Download } from "@playwright/test";
import { expect } from "@playwright/test";
import type { MockupEntry } from "./mockup-config";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const LS_GRAPHICS_BASE = "https://www.ls.graphics";

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Log in to LS Graphics via the nav user icon modal.
 * Expects LS_GRAPHICS_EMAIL and LS_GRAPHICS_PASSWORD env vars.
 */
export async function loginToLsGraphics(page: Page): Promise<void> {
  const email = process.env.LS_GRAPHICS_EMAIL;
  const password = process.env.LS_GRAPHICS_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "LS_GRAPHICS_EMAIL and LS_GRAPHICS_PASSWORD must be set in .env.local"
    );
  }

  // Navigate to any page to access the login modal
  await page.goto(LS_GRAPHICS_BASE, { waitUntil: "load" });

  // Click the user/account icon button in the header to open the auth modal.
  // The icon buttons use <svg> (not <img>). We find the rightmost small button
  // in the header area with no text — that's always the user icon.
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const iconBtns = buttons.filter((btn) => {
      const rect = btn.getBoundingClientRect();
      return rect.top < 80 && rect.width < 60 && !btn.textContent?.trim();
    });
    iconBtns.sort(
      (a, b) => b.getBoundingClientRect().x - a.getBoundingClientRect().x
    );
    if (iconBtns[0]) iconBtns[0].click();
  });

  // Wait for the sign-in modal to appear
  const emailField = page.getByRole("textbox", { name: "Email" });
  await emailField.waitFor({ state: "visible", timeout: 10_000 });

  // Fill email and proceed
  await emailField.fill(email);
  await page.getByRole("button", { name: "Next" }).click();

  // Wait for password field to appear
  const passwordField = page.getByRole("textbox", { name: "Password" });
  await passwordField.waitFor({ state: "visible", timeout: 10_000 });

  // Fill password and proceed
  await passwordField.fill(password);
  await page.getByRole("button", { name: "Next" }).click();

  // Dismiss marketing subscription prompt if shown (click Next without checkbox)
  await dismissMarketingPrompt(page);

  // Verify logged in — "Go to profile" link appears
  await expect(page.getByRole("link", { name: "Go to profile" })).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Skip the marketing email subscription modal if it appears after login.
 */
async function dismissMarketingPrompt(page: Page): Promise<void> {
  const nextBtn = page.getByRole("button", { name: "Next" });
  try {
    await nextBtn.waitFor({ state: "visible", timeout: 5000 });
    await nextBtn.click();
  } catch {
    // Not shown — already dismissed or returning user
  }
}

// ---------------------------------------------------------------------------
// Tutorial dismissal
// ---------------------------------------------------------------------------

/**
 * Dismiss the tutorial overlay ("Skip All") if visible.
 * Two-step tutorial: step 1 before upload, step 2 after crop.
 */
export async function dismissTutorial(page: Page): Promise<void> {
  const skipAll = page.getByRole("button", { name: "Skip All" });
  try {
    await skipAll.waitFor({ state: "visible", timeout: 3000 });
    // force: true because a transparent overlay div intercepts pointer events
    await skipAll.click({ force: true });
    await page.waitForTimeout(500);
  } catch {
    // Tutorial not shown or already dismissed
  }
}

// ---------------------------------------------------------------------------
// Upload flow
// ---------------------------------------------------------------------------

/**
 * Navigate to an LS Graphics scene and upload a screenshot into the mockup.
 *
 * @param page - Playwright page with active LS Graphics session
 * @param sceneSlug - Scene URL slug (e.g., "ab-mockups-scene-14")
 * @param screenshotPath - Absolute path to the screenshot PNG
 */
export async function uploadToScene(
  page: Page,
  sceneSlug: string,
  screenshotPath: string
): Promise<void> {
  // Navigate to scene page
  await page.goto(`${LS_GRAPHICS_BASE}/assets/${sceneSlug}`, {
    waitUntil: "load",
  });

  // Check for session redirect (if logged out mid-run)
  if (page.url().includes("/login") || page.url() === `${LS_GRAPHICS_BASE}/`) {
    throw new Error(
      `Session expired — redirected to ${page.url()} instead of scene page`
    );
  }

  // Click "Edit Online" to open the inline mockup editor if it hasn't
  // auto-loaded. The editor renders a canvas with a green screen area.
  const editBtn = page.getByRole("button", { name: "Edit Online" });
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await page.waitForTimeout(2000);
  }

  // Dismiss tutorial overlay BEFORE clicking the green screen.
  // The tutorial intercepts pointer events and prevents the editor from
  // registering which smart object was clicked — the upload modal opens
  // but the image won't be composited into the correct canvas layer.
  await dismissTutorial(page);

  // Click the green screen / mockup canvas area to open the upload modal.
  // The editor renders inside #editor > #scene.
  const scene = page.locator("#scene");
  await scene.waitFor({ state: "visible", timeout: 15_000 });
  const box = await scene.boundingBox();
  if (!box) throw new Error("Could not find #scene bounding box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  // Wait for upload modal to appear
  const browseBtn = page.getByRole("button", { name: "Browse" });
  await browseBtn.waitFor({ state: "visible", timeout: 10_000 });

  // Upload via Browse button + file chooser
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15_000 }),
    browseBtn.click(),
  ]);
  await fileChooser.setFiles(screenshotPath);
}

/**
 * Accept the default crop in the crop/resize editor and continue.
 */
export async function acceptCropAndContinue(page: Page): Promise<void> {
  const continueBtn = page.getByRole("button", { name: "Continue" });
  await continueBtn.waitFor({ state: "visible", timeout: 30_000 });
  await continueBtn.click();

  // Wait for the editor to composite the image into the mockup canvas
  await page.waitForTimeout(3000);
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Click the Download button, save the rendered mockup PNG,
 * convert to webp (quality 82), and delete the PNG.
 *
 * @returns The Playwright Download object
 */
export async function downloadMockup(
  page: Page,
  savePath: string
): Promise<Download> {
  // Dismiss tutorial step 2 if shown (appears after crop)
  await dismissTutorial(page);

  // Wait for Download button to be enabled (rendering may take time)
  const downloadBtn = page.getByRole("button", {
    name: "Download",
    exact: true,
  });
  await downloadBtn.waitFor({ state: "visible", timeout: 30_000 });
  await expect(downloadBtn).toBeEnabled({ timeout: 60_000 });

  // Trigger download
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 120_000 }),
    downloadBtn.click(),
  ]);

  // Save PNG to a temporary path, convert to webp, delete PNG
  const dir = path.dirname(savePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPngPath = savePath.replace(/\.webp$/, ".png");
  await download.saveAs(tmpPngPath);

  await sharp(tmpPngPath).webp({ quality: 82 }).toFile(savePath);
  fs.unlinkSync(tmpPngPath);
  console.log(`  WEBP → ${path.relative(process.cwd(), savePath)}`);

  return download;
}

// ---------------------------------------------------------------------------
// Full orchestration
// ---------------------------------------------------------------------------

/**
 * Generate a single mockup: navigate → upload → crop → download.
 *
 * @param page - Authenticated Playwright page
 * @param entry - Mockup configuration entry
 */
export async function generateMockup(
  page: Page,
  entry: MockupEntry
): Promise<void> {
  // Verify source screenshot exists
  if (!fs.existsSync(entry.screenshotPath)) {
    throw new Error(`Source screenshot not found: ${entry.screenshotPath}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(entry.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Upload screenshot to scene
  await uploadToScene(page, entry.scene.slug, entry.screenshotPath);

  // Accept default crop
  await acceptCropAndContinue(page);

  // Download rendered mockup
  await downloadMockup(page, entry.outputPath);
}
