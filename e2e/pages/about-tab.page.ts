/**
 * Page object for the About tab on item detail pages.
 * Covers tab switching, TMDB sections, and section filter.
 */
import { type Locator, type Page } from "@playwright/test";

export class AboutTabPage {
  readonly page: Page;
  readonly contentsTab: Locator;
  readonly aboutTab: Locator;
  readonly aboutContent: Locator;
  readonly castSection: Locator;
  readonly descriptionSection: Locator;
  readonly readMoreButton: Locator;
  readonly providersSection: Locator;
  readonly videosSection: Locator;
  readonly wikiSection: Locator;
  readonly recommendationsSection: Locator;
  readonly sectionFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.contentsTab = page.getByTestId("tab-contents");
    this.aboutTab = page.getByTestId("tab-about");
    this.aboutContent = page.getByTestId("about-tab-content");
    this.castSection = page.getByTestId("about-cast-section");
    this.descriptionSection = page.getByTestId("about-description-section");
    this.readMoreButton = page.getByTestId("read-more-button");
    this.providersSection = page.getByTestId("about-providers-section");
    this.videosSection = page.getByTestId("about-videos-section");
    this.wikiSection = page.getByTestId("about-wiki-section");
    this.recommendationsSection = page.getByTestId(
      "about-recommendations-section"
    );
    // FilterDropdown renders as a DropdownMenu button trigger (not a combobox)
    this.sectionFilter = page
      .getByRole("button", {
        name: /all sections|cast|about|where to watch|videos|learn more|more like this/i,
      })
      .first();
  }

  async switchToAbout() {
    await this.aboutTab.click();
  }

  async switchToContents() {
    await this.contentsTab.click();
  }

  /** Select a section filter option from the dropdown */
  async selectSectionFilter(section: string) {
    await this.sectionFilter.click();
    await this.page
      .getByRole("menuitemradio", { name: new RegExp(section, "i") })
      .click();
  }
}
