/**
 * Storybook test runner configuration.
 * Runs smoke tests and interaction tests for all stories.
 *
 * Accessibility checks are handled by the a11y addon (test: "error" in preview.tsx).
 * No custom pre/postVisit hooks needed — the addon manages axe injection and checks.
 */

import type { TestRunnerConfig } from "@storybook/test-runner";

const config: TestRunnerConfig = {};

export default config;
