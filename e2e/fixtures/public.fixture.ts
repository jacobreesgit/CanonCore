/**
 * Public (unauthenticated) test fixture.
 * No user creation — for explore, public profiles, landing page tests.
 */
import { test as base } from "@playwright/test";

export const publicFixture = base.extend<{
  isMobile: boolean;
}>({
  isMobile: async ({}, use, testInfo) => {
    const viewport = testInfo.project.use.viewport;
    await use(viewport ? viewport.width < 1024 : false);
  },
});
