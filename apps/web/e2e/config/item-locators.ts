/**
 * Shared item locator utilities for E2E Page Object Models.
 *
 * Both grid cards and tree items coexist in the DOM (toggled via CSS display),
 * so we filter for the visible element to avoid matching a hidden one.
 */
import type { Page, Locator } from "@playwright/test";
import { slugify } from "../../lib/slugify";
import { Timeouts } from "./timeouts";

/**
 * Get a visible locator for an item by name.
 * Matches either `item-card-{slug}` or `item-tree-{slug}`, filters for
 * the visible one, and returns the first match.
 */
export function getItemLocator(page: Page, name: string): Locator {
  const slug = slugify(name);
  return page
    .locator(
      `[data-testid="item-card-${slug}"], [data-testid="item-tree-${slug}"]`
    )
    .locator("visible=true")
    .first();
}

/**
 * Open the more options dropdown for an item.
 * Hovers the parent item to reveal the button (group-hover:opacity-100),
 * then clicks normally so Radix receives the full pointer event sequence.
 */
export async function openItemMoreMenu(page: Page, name: string) {
  const slug = slugify(name);
  const item = getItemLocator(page, name);
  await item.hover();
  const moreButton = item.getByTestId(`item-more-${slug}`);
  await moreButton.waitFor({ state: "visible", timeout: Timeouts.animation });
  await moreButton.click();
}
