/**
 * E2E tests for BreadcrumbList JSON-LD on public pages.
 * Verifies structured data is present in the page source.
 * Uses self-contained public user fixture — no seed dependency.
 */
import { publicTest, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

publicTest.describe("BreadcrumbList JSON-LD", () => {
  publicTest(
    "should include BreadcrumbList JSON-LD on public profile",
    async ({ page, publicUser }) => {
      await page.goto(`/u/${publicUser.username}`, {
        waitUntil: "domcontentloaded",
      });

      // Wait for the page to fully render
      await page.waitForLoadState("networkidle");

      // Check for BreadcrumbList JSON-LD script
      const jsonLd = await page.evaluate(() => {
        const scripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent ?? "");
            if (data["@type"] === "BreadcrumbList") return data;
          } catch {
            // skip invalid JSON
          }
        }
        return null;
      });

      expect(jsonLd).not.toBeNull();
      expect(jsonLd["@context"]).toBe("https://schema.org");
      expect(jsonLd["@type"]).toBe("BreadcrumbList");
      expect(jsonLd.itemListElement).toBeInstanceOf(Array);
      expect(jsonLd.itemListElement.length).toBeGreaterThanOrEqual(2);

      // First item should be "Home"
      expect(jsonLd.itemListElement[0].name).toBe("Home");
      expect(jsonLd.itemListElement[0].position).toBe(1);
    }
  );

  publicTest(
    "should include BreadcrumbList JSON-LD on public item detail",
    async ({ page, publicUser }) => {
      await page.goto(`/u/${publicUser.username}/${publicUser.itemId}`, {
        waitUntil: "domcontentloaded",
      });

      await page.waitForLoadState("load");

      const jsonLd = await page.evaluate(() => {
        const scripts = document.querySelectorAll(
          'script[type="application/ld+json"]'
        );
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent ?? "");
            if (data["@type"] === "BreadcrumbList") return data;
          } catch {
            // skip invalid JSON
          }
        }
        return null;
      });

      expect(jsonLd).not.toBeNull();
      expect(jsonLd["@type"]).toBe("BreadcrumbList");
      // Should have at least Home > Username > Item
      expect(jsonLd.itemListElement.length).toBeGreaterThanOrEqual(3);
    }
  );
});
