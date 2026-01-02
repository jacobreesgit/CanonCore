/**
 * Global teardown for E2E tests.
 * Stops all Docker SFTP containers after all tests.
 */

import { execSync } from "child_process";
import { test as teardown } from "@playwright/test";

teardown("stop Docker SFTP containers", async () => {
  // Check if Docker is available and running
  try {
    execSync("docker info", { stdio: "pipe" });
  } catch {
    console.log("Docker not running, skipping SFTP container teardown");
    return;
  }

  // Stop all Docker SFTP containers
  console.log("Stopping all Docker SFTP containers...");
  try {
    execSync("docker compose -f e2e/docker-compose.yml down", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    console.log("SFTP containers stopped");
  } catch (error) {
    console.error("Failed to stop SFTP containers:", error);
  }
});
