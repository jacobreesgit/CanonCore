/**
 * Composed test fixtures for E2E tests.
 * Provides POMs as fixture properties — tests destructure what they need.
 */
import { expect } from "@playwright/test";
import {
  authenticatedFixture,
  createPublicUser,
  createPublicUserWithItems,
  deletePublicUser,
  type PublicUserInfo,
  type PublicUserWithItemsInfo,
} from "./authenticated.fixture";
import { publicFixture } from "./public.fixture";
import { driveFixture } from "./drive.fixture";

// Import all POMs
import { ItemsCrudPage } from "../pages/items-crud.page";
import { ItemsSortFilterPage } from "../pages/items-sort-filter.page";
import { ItemsSettingsPage } from "../pages/items-settings.page";
import { ItemsPinnedPage } from "../pages/items-pinned.page";
import { ItemsDragPage } from "../pages/items-drag.page";
import { ItemsHierarchyPage } from "../pages/items-hierarchy.page";
import { ItemDetailPage } from "../pages/item-detail.page";
import { ExplorePage } from "../pages/explore.page";
import { PublicProfilePage } from "../pages/public-profile.page";
import { AuthPage } from "../pages/auth.page";
import { SettingsPage } from "../pages/settings.page";
import { SpotlightPage } from "../pages/spotlight.page";
import { MediaPage } from "../pages/media.page";
import { NavPage } from "../pages/nav.page";
import { TmdbWizardPage } from "../pages/tmdb-wizard.page";
import { PlaylistPage } from "../pages/playlist.page";

// Authenticated test with all POMs
export const test = authenticatedFixture.extend<{
  publicUser: PublicUserInfo;
  itemsCrud: ItemsCrudPage;
  itemsSortFilter: ItemsSortFilterPage;
  itemsSettings: ItemsSettingsPage;
  itemsPinned: ItemsPinnedPage;
  itemsDrag: ItemsDragPage;
  itemsHierarchy: ItemsHierarchyPage;
  itemDetail: ItemDetailPage;
  explore: ExplorePage;
  publicProfile: PublicProfilePage;
  auth: AuthPage;
  settings: SettingsPage;
  spotlight: SpotlightPage;
  media: MediaPage;
  nav: NavPage;
  tmdbWizard: TmdbWizardPage;
  playlist: PlaylistPage;
}>({
  publicUser: async ({}, use) => {
    const user = await createPublicUser();
    await use(user);
    await deletePublicUser(user.id);
  },
  // Suppress Next.js dev error overlay
  page: async ({ page }, use) => {
    const hideOverlay = async () => {
      await page
        .addStyleTag({
          content:
            "nextjs-portal { display: none !important; pointer-events: none !important; }",
        })
        .catch(() => {});
    };
    await hideOverlay();
    page.on("load", hideOverlay);
    await use(page);
  },
  itemsCrud: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsCrudPage(page, testUser.username, isMobile));
  },
  itemsSortFilter: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsSortFilterPage(page, testUser.username, isMobile));
  },
  itemsSettings: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsSettingsPage(page, testUser.username, isMobile));
  },
  itemsPinned: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsPinnedPage(page, testUser.username, isMobile));
  },
  itemsDrag: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsDragPage(page, testUser.username, isMobile));
  },
  itemsHierarchy: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemsHierarchyPage(page, testUser.username, isMobile));
  },
  itemDetail: async ({ page, testUser, isMobile }, use) => {
    await use(new ItemDetailPage(page, testUser.username, isMobile));
  },
  explore: async ({ page, isMobile }, use) => {
    await use(new ExplorePage(page, isMobile));
  },
  publicProfile: async ({ page, isMobile }, use) => {
    await use(new PublicProfilePage(page, isMobile));
  },
  auth: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  settings: async ({ page, isMobile }, use) => {
    await use(new SettingsPage(page, isMobile));
  },
  spotlight: async ({ page, isMobile }, use) => {
    await use(new SpotlightPage(page, isMobile));
  },
  media: async ({ page, testUser, isMobile }, use) => {
    await use(new MediaPage(page, testUser.username, isMobile));
  },
  nav: async ({ page, testUser, isMobile }, use) => {
    await use(new NavPage(page, testUser.username, isMobile));
  },
  tmdbWizard: async ({ page, testUser, isMobile }, use) => {
    await use(new TmdbWizardPage(page, testUser.username, isMobile));
  },
  playlist: async ({ page, testUser, isMobile }, use) => {
    await use(new PlaylistPage(page, testUser.username, isMobile));
  },
});

// Public test (no auth) with relevant POMs
export const publicTest = publicFixture.extend<{
  publicUser: PublicUserInfo;
  paginationUser: PublicUserWithItemsInfo;
  explore: ExplorePage;
  publicProfile: PublicProfilePage;
  auth: AuthPage;
  nav: NavPage;
  spotlight: SpotlightPage;
}>({
  publicUser: async ({}, use) => {
    const user = await createPublicUser();
    await use(user);
    await deletePublicUser(user.id);
  },
  paginationUser: async ({}, use) => {
    const user = await createPublicUserWithItems(26);
    await use(user);
    await deletePublicUser(user.id);
  },
  explore: async ({ page, isMobile }, use) => {
    await use(new ExplorePage(page, isMobile));
  },
  publicProfile: async ({ page, isMobile }, use) => {
    await use(new PublicProfilePage(page, isMobile));
  },
  auth: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  nav: async ({ page, isMobile }, use) => {
    await use(new NavPage(page, "", isMobile));
  },
  spotlight: async ({ page, isMobile }, use) => {
    await use(new SpotlightPage(page, isMobile));
  },
});

// Drive test with Drive-specific fixtures + POMs
export const driveTest = driveFixture;

export { expect };
export { prisma } from "./authenticated.fixture";
export type { PublicUserWithItemsInfo };
