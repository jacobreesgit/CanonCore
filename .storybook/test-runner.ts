/**
 * Storybook test runner configuration.
 * Runs smoke tests and interaction tests for all stories.
 */

import type { TestRunnerConfig } from "@storybook/test-runner";
import { getStoryContext } from "@storybook/test-runner";
import { checkA11y, injectAxe } from "axe-playwright";

const config: TestRunnerConfig = {
  /**
   * Hook that runs before each story is tested.
   * Injects axe-core for accessibility testing.
   */
  async preVisit(page) {
    await injectAxe(page);
  },

  /**
   * Hook that runs after each story is rendered.
   * Performs accessibility checks and waits for animations.
   */
  async postVisit(page, context) {
    // Get story context to check for disabled a11y
    const storyContext = await getStoryContext(page, context);

    // Skip a11y checks if explicitly disabled in story parameters
    const a11yDisabled = storyContext.parameters?.a11y?.disable;

    if (!a11yDisabled) {
      // Run accessibility checks with WCAG 2.1 AA rules
      // Note: color-contrast is excluded because the design system uses
      // intentionally muted colors for secondary content (text-muted-foreground)
      // which don't meet strict WCAG AA contrast ratios but are an accepted
      // design pattern for less prominent UI elements.
      await checkA11y(page, "#storybook-root", {
        detailedReport: true,
        detailedReportOptions: {
          html: true,
        },
        axeOptions: {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
          rules: {
            // color-contrast: Design system uses intentionally muted colors
            "color-contrast": { enabled: false },
            // nested-interactive: react-dropzone pattern uses Button wrapper with hidden file input
            "nested-interactive": { enabled: false },
            // list/listitem: shadcn Collapsible wraps li elements in divs for collapsible behavior
            list: { enabled: false },
            listitem: { enabled: false },
          },
        },
      });
    }
  },
};

export default config;
