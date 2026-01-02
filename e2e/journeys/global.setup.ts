/**
 * Global setup for E2E tests.
 * Starts Docker Desktop and SFTP containers before all tests.
 * Spawns one container per Playwright worker for parallel test execution.
 */

import { execSync, spawn } from "child_process";
import os from "os";
import { test as setup } from "@playwright/test";
import {
  getSftpConfigForWorker,
  waitForSftpReady,
} from "../fixtures/sftp.fixture";

const MAX_WORKERS = 8;

/**
 * Calculates number of workers to start based on environment.
 * Matches Playwright's default worker calculation, capped at MAX_WORKERS.
 *
 * @returns Number of SFTP containers to start
 */
function getWorkerCount(): number {
  if (process.env.CI) return 1;
  const detected = Math.floor(os.cpus().length / 2);
  return Math.max(1, Math.min(detected, MAX_WORKERS));
}

/**
 * Waits for Docker daemon to be ready.
 *
 * @param maxAttempts - Maximum number of attempts
 * @param delayMs - Delay between attempts in milliseconds
 */
async function waitForDockerReady(
  maxAttempts = 60,
  delayMs = 2000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync("docker info", { stdio: "pipe" });
      return true;
    } catch {
      if (i < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  return false;
}

/**
 * Checks if Docker daemon is currently running.
 */
function isDockerRunning(): boolean {
  try {
    execSync("docker info", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens Docker Desktop application on macOS.
 */
function openDockerDesktop(): void {
  spawn("open", ["-a", "Docker"], { detached: true, stdio: "ignore" });
}

setup("start Docker SFTP containers", async () => {
  // Check if Docker CLI is installed
  try {
    execSync("docker --version", { stdio: "pipe" });
  } catch {
    console.log("Docker CLI not installed, skipping SFTP container setup");
    console.log("Install Docker Desktop: brew install --cask docker");
    return;
  }

  // Check if Docker daemon is running, if not start Docker Desktop
  if (!isDockerRunning()) {
    console.log("Docker daemon not running, starting Docker Desktop...");
    openDockerDesktop();

    console.log(
      "Waiting for Docker daemon to be ready (this may take a minute)..."
    );
    const ready = await waitForDockerReady(60, 2000);

    if (!ready) {
      console.log("Docker daemon failed to start, skipping SFTP tests");
      return;
    }
    console.log("Docker daemon is ready");
  }

  // Calculate how many containers to start
  const workerCount = getWorkerCount();
  const services = Array.from(
    { length: workerCount },
    (_, i) => `sftp-${i}`
  ).join(" ");

  // Clean up any existing containers first to avoid race conditions
  console.log("Cleaning up any existing SFTP containers...");
  try {
    execSync("docker compose -f e2e/docker-compose.yml down --remove-orphans", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    // Brief pause to let Docker fully clean up
    await new Promise((r) => setTimeout(r, 1000));
  } catch {
    // Ignore errors - containers might not exist
  }

  // Start Docker SFTP containers for each worker
  console.log(`Starting ${workerCount} Docker SFTP containers...`);
  try {
    // Single command with --wait flag handles startup and health check waiting
    execSync(
      `docker compose -f e2e/docker-compose.yml up -d --wait ${services}`,
      {
        stdio: "inherit",
        cwd: process.cwd(),
      }
    );

    // Verify each container is ready
    console.log("Verifying SFTP containers are ready...");
    for (let i = 0; i < workerCount; i++) {
      const config = getSftpConfigForWorker(i);
      await waitForSftpReady(config, 30, 1000);
    }
    console.log(`${workerCount} SFTP containers ready`);
  } catch (error) {
    console.error("Failed to start SFTP containers:", error);
  }
});
