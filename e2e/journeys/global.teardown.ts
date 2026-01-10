/**
 * Global teardown for E2E tests.
 * Placeholder for any global cleanup needed after all tests.
 */

import { test as teardown } from "@playwright/test";

teardown("global teardown", async () => {
  // No global teardown required currently
  console.log("E2E test teardown complete");
});
