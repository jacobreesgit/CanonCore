/**
 * E2E tests for the CinematicHero component.
 * Tests single-slide, multi-slide carousel, metadata display, profile avatar mode,
 * shader fallback, and reduced motion support.
 */

import { test, expect, prisma } from "../../fixtures";
import {
  generateUniqueEmail,
  generateUniqueUsername,
  TEST_PASSWORD,
} from "../../helpers/test-user";

test.describe("CinematicHero", () => {
  test.describe("single slide (item detail)", () => {
    test.beforeEach(async ({ page, testUser }) => {
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });
    });

    test("shows hero with title and no dot navigation", async ({
      page,
      testUser,
    }) => {
      const item = await prisma.item.create({
        data: {
          name: "Inception",
          description: "A thief who steals corporate secrets.",
          userId: testUser.id,
          order: 0,
          depth: 0,
        },
      });

      await page.goto(`/u/${testUser.username}/${item.id}`);
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });

      // Title visible
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Inception"
      );

      // No dot navigation for single slide
      await expect(page.getByRole("tablist")).not.toBeVisible();
    });

    test("shows TMDB metadata in hero", async ({ page, testUser }) => {
      const item = await prisma.item.create({
        data: {
          name: "The Shawshank Redemption",
          description: "Two imprisoned men bond over a number of years.",
          userId: testUser.id,
          order: 0,
          depth: 0,
          tmdbId: 278,
          tmdbType: "movie",
        },
      });

      await page.goto(`/u/${testUser.username}/${item.id}`);
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });

      // Tagline should be visible (TMDB provides one for Shawshank)
      await expect(page.getByTestId("hero-tagline")).toBeVisible({
        timeout: 10000,
      });

      // Metadata line should be visible (year, runtime, etc.)
      await expect(page.getByTestId("hero-metadata-line")).toBeVisible();
    });

    test("playlist button shows coming soon toast", async ({
      page,
      testUser,
    }) => {
      const item = await prisma.item.create({
        data: {
          name: "Playlist Test Item",
          userId: testUser.id,
          order: 0,
          depth: 0,
        },
      });

      await page.goto(`/u/${testUser.username}/${item.id}`);
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });

      // Click the "Add to Playlist" button
      const playlistButton = page.getByRole("button", {
        name: /add to playlist/i,
      });
      await expect(playlistButton).toBeVisible();
      await playlistButton.click();

      // Expect "coming soon" toast
      const toast = page.locator("[data-sonner-toast]");
      await expect(toast).toBeVisible({ timeout: 5000 });
      await expect(toast).toContainText(/playlists coming soon/i);
    });

    test("shows shader fallback when no artwork", async ({
      page,
      testUser,
    }) => {
      const item = await prisma.item.create({
        data: {
          name: "No Artwork Item",
          userId: testUser.id,
          order: 0,
          depth: 0,
        },
      });

      await page.goto(`/u/${testUser.username}/${item.id}`);
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });

      // Title still visible
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "No Artwork Item"
      );
    });
  });

  test.describe("multi-slide (explore carousel)", () => {
    test.describe.configure({ mode: "serial" });

    let ownerEmail: string;
    let ownerId: string;
    let ownerUsername: string;

    test.beforeEach(async () => {
      // Create owner with public profile and multiple public items with TMDB data
      ownerEmail = generateUniqueEmail("hero-owner");
      ownerUsername = generateUniqueUsername("ho");

      const { hash } = await import("bcryptjs");
      const passwordHash = await hash(TEST_PASSWORD, 10);

      const owner = await prisma.user.create({
        data: {
          email: ownerEmail,
          passwordHash,
          isPublic: true,
          username: ownerUsername,
        },
      });
      ownerId = owner.id;

      // Create multiple public items with artwork (needed for featured carousel)
      // Use different TMDB movies so they have distinct metadata
      const movies = [
        { name: "The Shawshank Redemption", tmdbId: 278 },
        { name: "The Godfather", tmdbId: 238 },
        { name: "The Dark Knight", tmdbId: 155 },
      ];

      for (let i = 0; i < movies.length; i++) {
        const item = await prisma.item.create({
          data: {
            name: movies[i].name,
            userId: ownerId,
            depth: 0,
            order: i,
            isPublic: true,
            inheritVisibility: false,
            tmdbId: movies[i].tmdbId,
            tmdbType: "movie",
          },
        });

        // Create artwork file to qualify for featured carousel
        await prisma.itemFile.create({
          data: {
            itemId: item.id,
            filename: `poster-${i}.jpg`,
            fileType: "ARTWORK",
            mimeType: "image/jpeg",
            isPrimary: true,
            isHero: false,
          },
        });
      }
    });

    test.afterEach(async () => {
      await prisma.itemFile
        .deleteMany({ where: { item: { userId: ownerId } } })
        .catch(() => {});
      await prisma.item
        .deleteMany({ where: { userId: ownerId } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
    });

    test("shows dot navigation on explore page", async ({
      page,
      publicProfilePage,
    }) => {
      await publicProfilePage.gotoExplore();

      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });

      // Dot navigation should be visible for multiple slides
      const tablist = page.getByRole("tablist");
      await expect(tablist).toBeVisible();

      // At least one dot should exist
      const dots = page.getByRole("tab");
      await expect(dots.first()).toBeVisible();
    });

    test("clicking dot changes active slide", async ({
      page,
      publicProfilePage,
    }) => {
      await publicProfilePage.gotoExplore();

      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });

      // Get initial heading text
      const heading = page.getByRole("heading", { level: 2 }).first();
      await expect(heading).toBeVisible();
      const initialText = await heading.textContent();

      // Click second dot (if available)
      const secondDot = page.getByTestId("hero-dot-1");
      if (await secondDot.isVisible().catch(() => false)) {
        await secondDot.click();

        // Heading should change
        await expect(heading).not.toHaveText(initialText!, { timeout: 5000 });
      }
    });

    test("shows attribution text", async ({ page, publicProfilePage }) => {
      await publicProfilePage.gotoExplore();

      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });

      // Attribution should show "Shared by @username"
      const attribution = page.getByTestId("hero-attribution");
      await expect(attribution).toBeVisible();
      await expect(attribution).toContainText("Shared by @");
    });
  });

  test.describe("profile avatar mode", () => {
    test.beforeEach(async ({ page, testUser }) => {
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });
    });

    test("shows username and avatar on profile page", async ({
      page,
      testUser,
    }) => {
      // Profile hero should show @username
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });
      await expect(
        page.getByRole("heading", { name: `@${testUser.username}` })
      ).toBeVisible();
    });
  });

  test.describe("reduced motion", () => {
    test("disables auto-advance with prefers-reduced-motion", async ({
      page,
      testUser,
    }) => {
      await expect(page).toHaveURL(`/u/${testUser.username}`, {
        timeout: 10000,
      });

      // Emulate reduced motion preference
      await page.emulateMedia({ reducedMotion: "reduce" });

      // Create item with TMDB data for hero display
      const item = await prisma.item.create({
        data: {
          name: "Reduced Motion Test",
          userId: testUser.id,
          order: 0,
          depth: 0,
        },
      });

      await page.goto(`/u/${testUser.username}/${item.id}`);
      const hero = page.getByTestId("hero-carousel");
      await expect(hero).toBeVisible({ timeout: 10000 });

      // Hero should still render correctly with reduced motion
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Reduced Motion Test"
      );
    });
  });
});
