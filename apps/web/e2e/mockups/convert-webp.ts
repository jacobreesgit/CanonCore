/**
 * Standalone PNG → webp converter for screenshot images.
 *
 * Converts screenshots from e2e/output/screenshots/ to webp in public/images/.
 * Converts both laptop and mobile PNGs, preserving the suffix in the output name.
 *
 * Usage:
 *   pnpm run mockups:webp                    # convert all screenshots
 *   pnpm run mockups:webp -- 10-mini-player  # convert specific screenshot (both viewports)
 *   pnpm run mockups:webp -- 03 07           # convert multiple by prefix
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SCREENSHOTS_DIR = path.resolve("e2e/output/screenshots");
const IMAGES_DIR = path.resolve("public/images");

const QUALITY = 82;

async function convert(pngPath: string, webpPath: string): Promise<void> {
  const dir = path.dirname(webpPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  await sharp(pngPath).webp({ quality: QUALITY }).toFile(webpPath);
  const stats = fs.statSync(webpPath);
  const kb = (stats.size / 1024).toFixed(0);
  console.log(`  WEBP (${kb}KB) → ${path.relative(process.cwd(), webpPath)}`);
}

async function main(): Promise<void> {
  const filters = process.argv.slice(2);

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.error(`Screenshots directory not found: ${SCREENSHOTS_DIR}`);
    process.exit(1);
  }

  // Find all PNGs (both laptop and mobile)
  const allPngs = fs
    .readdirSync(SCREENSHOTS_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();

  const pngs =
    filters.length > 0
      ? allPngs.filter((f) => filters.some((filter) => f.includes(filter)))
      : allPngs;

  if (pngs.length === 0) {
    console.error(
      filters.length > 0
        ? `No screenshots matching: ${filters.join(", ")}`
        : "No screenshots found"
    );
    process.exit(1);
  }

  console.log(`Converting ${pngs.length} screenshot(s) to webp...\n`);

  for (const png of pngs) {
    const name = png.replace(".png", "");
    const pngPath = path.join(SCREENSHOTS_DIR, png);
    const webpPath = path.join(IMAGES_DIR, `${name}.webp`);
    await convert(pngPath, webpPath);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
