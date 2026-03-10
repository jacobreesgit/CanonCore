/**
 * E2E tests for viewer more-options menu on another user's public items.
 * Covers Fork, Add to Playlist, and guest sign-in prompt.
 *
 * TODO: These tests require hover to reveal the more-options button
 * (group-hover:opacity-100). This is unreliable in Playwright — hover
 * doesn't work on mobile touch devices, and desktop tests are flaky
 * because the card may be below the fold. Re-enable once the grid card
 * exposes the more button via tap/long-press on mobile.
 */
import { test, publicTest } from "../../fixtures";

test.describe("Viewer context menu on public items", () => {
  test.fixme("shows Add to Playlist and Fork on right-click", async () => {});
});

publicTest.describe("Guest viewer context menu", () => {
  publicTest.fixme("shows Sign in to Fork for guests", async () => {});
});
