/**
 * Page object for TMDB wizard interactions.
 * Covers searching TMDB, navigating wizard steps (text, poster, hero, logo, summary),
 * and creating items with TMDB metadata.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class TmdbWizardPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Dialog ─────────────────────────────────────────────

  /**
   * Open the Add Item dialog by clicking the add button.
   * Waits for the combobox to be visible.
   */
  async openAddItemDialog() {
    await this.page.getByTestId("items-add-button").click();

    // Wait for the media search input to be ready
    const combobox = this.page.getByTestId("media-search-input");
    await combobox.waitFor({ state: "visible", timeout: Timeouts.api });
  }

  // ── TMDB Search ────────────────────────────────────────

  /**
   * Search for a movie or TV show in the TMDB combobox and select the first result.
   * Types the query, waits for results to load, and clicks the first option.
   *
   * @param query - The search term (e.g., "The Matrix")
   */
  async searchAndSelectFirst(query: string) {
    const combobox = this.page.getByTestId("media-search-input");
    await combobox.waitFor({ state: "visible", timeout: Timeouts.api });
    await combobox.fill(query);

    // Wait for first result option directly (listbox container is always in DOM, hidden via CSS).
    // .first() is acceptable here: we intentionally want the top search result
    // and multiple options are expected (e.g., "The Matrix" returns sequels too).
    const firstResult = this.page.getByRole("option").first();
    await firstResult.waitFor({ state: "visible", timeout: Timeouts.api });
    await firstResult.click();
  }

  // ── Wizard Steps ───────────────────────────────────────

  /**
   * Wait for the TMDB wizard to appear on a specific step.
   *
   * @param step - The wizard step to wait for (text, poster, hero, logo, summary)
   */
  async expectWizardStep(
    step: "text" | "poster" | "hero" | "logo" | "still" | "summary"
  ) {
    await expect(this.page.getByTestId(`tmdb-wizard-step-${step}`)).toBeVisible(
      { timeout: Timeouts.api }
    );
  }

  /**
   * Complete the text step by proceeding with default options.
   * Waits for text step to be visible, then clicks Next.
   */
  async completeTextStep() {
    await this.expectWizardStep("text");

    const nextButton = this.page.getByTestId("tmdb-wizard-next");
    await nextButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await nextButton.click();
  }

  /**
   * Skip all remaining artwork steps (poster + hero + logo).
   * Clicks the "Skip All" button on the poster step.
   */
  async skipArtworkSteps() {
    await this.expectWizardStep("poster");

    const skipAllButton = this.page.getByTestId("tmdb-wizard-skip-all");
    await skipAllButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await skipAllButton.click();
  }

  /**
   * Advance past the current artwork step by clicking Next.
   * Use this to step through individual artwork steps (poster, hero, logo)
   * rather than skipping all at once.
   */
  async advanceArtworkStep() {
    const nextButton = this.page.getByTestId("tmdb-wizard-next");
    await nextButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await nextButton.click();
  }

  /**
   * Select the first logo option on the logo step.
   * Clicks the first logo thumbnail button in the grid.
   */
  async selectFirstLogo() {
    await this.expectWizardStep("logo");

    // Logo thumbnails are buttons with role="button" containing logo images
    const logoButton = this.page
      .getByTestId("tmdb-wizard-step-logo")
      .getByRole("button")
      .first();
    await logoButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await logoButton.click();
  }

  /**
   * Apply the wizard selections on the summary step.
   * Waits for the summary step, then clicks Apply.
   */
  async applyWizard() {
    await this.expectWizardStep("summary");

    const applyButton = this.page.getByTestId("tmdb-wizard-next");
    await applyButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await applyButton.click();
  }

  /**
   * Create the item from the wizard summary review step.
   * Waits for the "Review & Create" view, then clicks Create.
   */
  async createFromSummary() {
    const createButton = this.page.getByTestId("wizard-summary-create");
    await createButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await createButton.click();
  }

  // ── Full Flow ──────────────────────────────────────────

  /**
   * Complete the full TMDB wizard flow: search, skip artwork, apply, and create.
   * This is a convenience method for tests that need an item with TMDB metadata
   * but don't need to test individual wizard steps.
   *
   * @param query - The TMDB search term (e.g., "The Matrix")
   */
  async createItemWithTmdb(query: string) {
    await this.openAddItemDialog();
    await this.searchAndSelectFirst(query);
    await this.completeTextStep();
    await this.skipArtworkSteps();
    await this.applyWizard();
    await this.createFromSummary();
  }
}
