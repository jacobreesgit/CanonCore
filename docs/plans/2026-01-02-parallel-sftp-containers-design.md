# Parallel SFTP Containers Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable parallel SFTP E2E test execution by providing isolated SFTP containers per Playwright worker.

**Architecture:** Static docker-compose with 8 pre-defined SFTP containers on ports 2222-2229. Global setup starts only the containers needed based on detected worker count. Each worker gets exclusive access to its container via `testInfo.parallelIndex` mapping. SFTP helper functions are refactored to accept an optional config parameter for worker-specific connections.

**Tech Stack:** Playwright, Docker Compose, ssh2-sftp-client, TypeScript

---

## Problem Analysis

Current SFTP tests run serially (`--workers=1`) because:

1. All tests share a single SFTP container on port 2222
2. `cleanSftpTestDir()` in `beforeEach` causes race conditions with parallel workers
3. One test's cleanup can delete another test's data mid-execution

**Solution:** Per-worker SFTP containers eliminate shared state entirely.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Playwright Test Runner                    │
├─────────────┬─────────────┬─────────────┬─────────────┬─────┤
│  Worker 0   │  Worker 1   │  Worker 2   │  Worker 3   │ ... │
├─────────────┼─────────────┼─────────────┼─────────────┼─────┤
│  Port 2222  │  Port 2223  │  Port 2224  │  Port 2225  │ ... │
├─────────────┼─────────────┼─────────────┼─────────────┼─────┤
│ e2e-sftp-0  │ e2e-sftp-1  │ e2e-sftp-2  │ e2e-sftp-3  │ ... │
└─────────────┴─────────────┴─────────────┴─────────────┴─────┘
```

**Key Properties:**

- Each worker has exclusive access to its container
- No shared state between workers
- Retries use same `workerIndex` → same container
- `beforeEach` cleanup ensures fresh state for retries

---

## Container Configuration

**File:** `e2e/docker-compose.yml`

Uses YAML anchors to reduce duplication. Includes `start_period` for proper health check initialization.

```yaml
# Shared SFTP configuration using YAML anchor
x-sftp-common: &sftp-common
  image: atmoz/sftp
  command: testuser:testpass:1001:1001:upload
  tmpfs:
    - /home/testuser/upload:uid=1001,gid=1001
  healthcheck:
    test: ["CMD", "nc", "-z", "localhost", "22"]
    interval: 1s
    timeout: 3s
    retries: 10
    start_period: 5s

services:
  sftp-0:
    <<: *sftp-common
    container_name: e2e-sftp-0
    ports: ["2222:22"]

  sftp-1:
    <<: *sftp-common
    container_name: e2e-sftp-1
    ports: ["2223:22"]

  sftp-2:
    <<: *sftp-common
    container_name: e2e-sftp-2
    ports: ["2224:22"]

  sftp-3:
    <<: *sftp-common
    container_name: e2e-sftp-3
    ports: ["2225:22"]

  sftp-4:
    <<: *sftp-common
    container_name: e2e-sftp-4
    ports: ["2226:22"]

  sftp-5:
    <<: *sftp-common
    container_name: e2e-sftp-5
    ports: ["2227:22"]

  sftp-6:
    <<: *sftp-common
    container_name: e2e-sftp-6
    ports: ["2228:22"]

  sftp-7:
    <<: *sftp-common
    container_name: e2e-sftp-7
    ports: ["2229:22"]
```

**Why 8 containers:**

- Playwright default workers = `os.cpus().length / 2`
- Most dev machines: 8-16 cores → 4-8 workers
- 8 containers covers typical scenarios with headroom
- Global setup caps worker count to MAX_WORKERS to prevent overflow

---

## Fixture & Worker Assignment

**File:** `e2e/fixtures/sftp.fixture.ts`

**Important:** Use `testInfo.parallelIndex` (not `workerIndex`). `parallelIndex` is bounded by worker count, while `workerIndex` can exceed container count due to worker restarts.

```typescript
const BASE_PORT = 2222;
const MAX_WORKERS = 8;

export interface SftpTestConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  basePath: string;
}

/**
 * Returns SFTP config for a specific worker.
 * Each worker gets an isolated container on its own port.
 *
 * @param parallelIndex - Playwright testInfo.parallelIndex (0-based, bounded by worker count)
 * @returns SFTP connection config for this worker's container
 * @throws Error if parallelIndex is out of valid range
 */
export function getSftpConfigForWorker(parallelIndex: number): SftpTestConfig {
  if (parallelIndex < 0 || parallelIndex >= MAX_WORKERS) {
    throw new Error(
      `Invalid parallelIndex ${parallelIndex}. Must be 0-${MAX_WORKERS - 1}. ` +
        `Ensure Playwright workers ≤ ${MAX_WORKERS}.`
    );
  }

  return {
    host: "localhost",
    port: BASE_PORT + parallelIndex,
    username: "testuser",
    password: "testpass",
    basePath: "/upload",
  };
}

// Legacy export for backward compatibility (uses worker 0)
export const sftpTestConfig = getSftpConfigForWorker(0);
```

---

## Refactored SFTP Helper Functions

All SFTP helpers must accept an optional config parameter to support per-worker containers.

**File:** `e2e/fixtures/sftp.fixture.ts`

```typescript
/**
 * Creates an SFTP client connected to the specified server.
 *
 * @param config - SFTP config (defaults to sftpTestConfig for backward compatibility)
 * @returns Connected SFTP client
 */
async function getClient(
  config: SftpTestConfig = sftpTestConfig
): Promise<Client> {
  const sftp = new Client();
  await sftp.connect({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 10000,
  });
  return sftp;
}

/**
 * Cleans all files from the SFTP test directory.
 *
 * @param config - SFTP config (defaults to sftpTestConfig)
 */
export async function cleanSftpTestDir(
  config: SftpTestConfig = sftpTestConfig
): Promise<void> {
  const sftp = await getClient(config);
  try {
    const files = await sftp.list(config.basePath);
    for (const file of files) {
      const fullPath = `${config.basePath}/${file.name}`;
      if (file.type === "d") {
        await sftp.rmdir(fullPath, true);
      } else {
        await sftp.delete(fullPath);
      }
    }
  } finally {
    await sftp.end();
  }
}

/**
 * Creates a test file on the SFTP server.
 *
 * @param path - Path to create file at
 * @param content - File content
 * @param config - SFTP config (defaults to sftpTestConfig)
 */
export async function createSftpTestFile(
  path: string,
  content: string,
  config: SftpTestConfig = sftpTestConfig
): Promise<void> {
  const sftp = await getClient(config);
  try {
    await sftp.put(Buffer.from(content), path);
  } finally {
    await sftp.end();
  }
}

// Apply same pattern to: verifySftpFileExists, createSftpTestDir,
// deleteSftpTestPath, listSftpDir, readSftpFile, waitForSftpReady,
// waitForSftpPathExists, waitForSftpPathDeleted, etc.
```

**Test Usage:**

```typescript
test("creates folder on SFTP", async ({ page }, testInfo) => {
  // Use parallelIndex (bounded by worker count) not workerIndex
  const config = getSftpConfigForWorker(testInfo.parallelIndex);

  // Pass config to all SFTP helper functions
  await cleanSftpTestDir(config);
  await createSftpTestFile(`${config.basePath}/test.txt`, "content", config);
  await waitForSftpPathExists(`${config.basePath}/test.txt`, {}, config);
});
```

**Alternative: Worker-Scoped Fixture**

For cleaner test code, create a Playwright fixture that provides the config:

```typescript
// e2e/fixtures/index.ts
import { test as base } from "@playwright/test";
import { getSftpConfigForWorker, SftpTestConfig } from "./sftp.fixture";

export const test = base.extend<{ sftpConfig: SftpTestConfig }>({
  sftpConfig: async ({}, use, testInfo) => {
    const config = getSftpConfigForWorker(testInfo.parallelIndex);
    await use(config);
  },
});

// In tests:
test("creates folder on SFTP", async ({ page, sftpConfig }) => {
  await cleanSftpTestDir(sftpConfig);
  await createSftpTestFile(
    `${sftpConfig.basePath}/test.txt`,
    "content",
    sftpConfig
  );
});
```

---

## Global Setup & Teardown

**File:** `e2e/journeys/global.setup.ts`

```typescript
import { execSync } from "child_process";
import os from "os";
import path from "path";

const MAX_WORKERS = 8;

function getWorkerCount(): number {
  if (process.env.CI) return 1;
  // Cap to MAX_WORKERS to prevent exceeding available containers
  const detected = Math.floor(os.cpus().length / 2);
  return Math.max(1, Math.min(detected, MAX_WORKERS));
}

export default async function globalSetup() {
  const workerCount = getWorkerCount();
  const services = Array.from(
    { length: workerCount },
    (_, i) => `sftp-${i}`
  ).join(" ");

  const composePath = path.join(__dirname, "..", "docker-compose.yml");

  console.log(`Starting ${workerCount} SFTP containers...`);

  // Single command with --wait flag handles both startup and health check waiting
  execSync(`docker-compose -f ${composePath} up -d --wait ${services}`, {
    stdio: "inherit",
  });

  console.log("SFTP containers ready");
}
```

**File:** `e2e/journeys/global.teardown.ts`

```typescript
import { execSync } from "child_process";
import path from "path";

export default async function globalTeardown() {
  const composePath = path.join(__dirname, "..", "docker-compose.yml");

  console.log("Stopping all SFTP containers...");
  execSync(`docker-compose -f ${composePath} down`, {
    stdio: "inherit",
  });
  console.log("SFTP containers stopped");
}
```

---

## Testing Strategy

### Unit Tests

New `getSftpConfigForWorker` function needs unit tests:

**File:** `tests/unit/e2e/sftp-fixture.test.ts`

```typescript
describe("getSftpConfigForWorker", () => {
  it("returns port 2222 for parallelIndex 0", () => {
    const config = getSftpConfigForWorker(0);
    expect(config.port).toBe(2222);
    expect(config.host).toBe("localhost");
  });

  it("returns port 2225 for parallelIndex 3", () => {
    const config = getSftpConfigForWorker(3);
    expect(config.port).toBe(2225);
  });

  it("returns port 2229 for parallelIndex 7 (max)", () => {
    const config = getSftpConfigForWorker(7);
    expect(config.port).toBe(2229);
  });

  it("throws for negative parallelIndex", () => {
    expect(() => getSftpConfigForWorker(-1)).toThrow(/Invalid parallelIndex/);
  });

  it("throws for parallelIndex >= MAX_WORKERS", () => {
    expect(() => getSftpConfigForWorker(8)).toThrow(/Invalid parallelIndex/);
    expect(() => getSftpConfigForWorker(100)).toThrow(/Invalid parallelIndex/);
  });
});
```

### Integration Tests

No changes needed - existing SFTP integration tests use `sftpTestConfig` which defaults to port 2222. They continue working against the first container.

### E2E Tests

- Remove `test.describe.configure({ mode: "serial" })` from SFTP specs
- Remove `--workers=1` requirement from docs/comments
- Update tests to use `sftpConfig` fixture or pass config to helper functions
- Tests automatically get isolated containers via `testInfo.parallelIndex`

---

## Error Handling & Edge Cases

### Container Startup Failures

- Health check with retries (10 attempts, 1s intervals) + 5s start_period
- If container fails to start, docker-compose --wait fails with clear error
- Global setup fails fast if any required container unhealthy

### Port Conflicts

- Static port range 2222-2229 reserved for SFTP
- If ports in use, docker-compose fails with clear error
- Developer must stop conflicting services

### Worker Count Exceeds Containers

- 8 containers defined, Playwright auto-detects workers (typically 4-8)
- Global setup caps worker count to MAX_WORKERS (8)
- `getSftpConfigForWorker` throws descriptive error for invalid parallelIndex
- High-core machines (>16 cores) capped at 8 workers for SFTP tests

### Cleanup on Crash

- `globalTeardown` runs even on test failures
- Containers stopped via `docker-compose down`
- If teardown fails, containers persist (manual cleanup: `docker-compose -f e2e/docker-compose.yml down`)

### CI Environment

- CI uses `workers: 1` (already configured in playwright.config.ts)
- Only one container started in CI
- No changes needed for CI behavior

### Retry Behavior

- Playwright retries use same `parallelIndex` → same container
- `beforeEach` runs `cleanSftpTestDir(config)` before retry → fresh state
- No special retry configuration needed

---

## Implementation Tasks

### Task 1: Update docker-compose.yml

**Files:**

- Modify: `e2e/docker-compose.yml`

Replace single `sftp` service with 8 numbered services using YAML anchors:

- Add `x-sftp-common` anchor with shared configuration
- Add `start_period: 5s` to health checks
- Define `sftp-0` through `sftp-7` services on ports 2222-2229

### Task 2: Add getSftpConfigForWorker function

**Files:**

- Modify: `e2e/fixtures/sftp.fixture.ts`
- Create: `tests/unit/e2e/sftp-fixture.test.ts`

Add the worker-aware config function:

- Export `SftpTestConfig` interface
- Add `getSftpConfigForWorker(parallelIndex)` function
- Add unit tests for valid and invalid indices

### Task 3: Refactor SFTP helper functions

**Files:**

- Modify: `e2e/fixtures/sftp.fixture.ts`

Add optional `config` parameter to all helper functions:

- `getClient(config?)`
- `cleanSftpTestDir(config?)`
- `createSftpTestFile(path, content, config?)`
- `verifySftpFileExists(path, config?)`
- `createSftpTestDir(path, config?)`
- `deleteSftpTestPath(path, config?)`
- `listSftpDir(path, config?)`
- `readSftpFile(path, config?)`
- `waitForSftpReady(maxAttempts?, delayMs?, config?)`
- `waitForSftpPathExists(path, options?, config?)`
- `waitForSftpPathDeleted(path, options?, config?)`
- `waitForSftpDirContains(dirPath, itemName, options?, config?)`
- `waitForSftpDirNotContains(dirPath, itemName, options?, config?)`

### Task 4: Add sftpConfig fixture

**Files:**

- Modify: `e2e/fixtures/index.ts`

Add worker-scoped `sftpConfig` fixture using `testInfo.parallelIndex`.

### Task 5: Update global setup/teardown

**Files:**

- Modify: `e2e/journeys/global.setup.ts`
- Modify: `e2e/journeys/global.teardown.ts`

- Add `MAX_WORKERS` constant
- Cap detected worker count to MAX_WORKERS
- Use single `docker-compose up -d --wait` command

### Task 6: Update SFTP test specs

**Files:**

- Modify: `e2e/journeys/sftp/sftp-web-to-server.spec.ts`
- Modify: `e2e/journeys/sftp/sftp-server-to-web.spec.ts`
- Modify: `e2e/journeys/sftp/sftp-sync.spec.ts`

- Remove `test.describe.configure({ mode: "serial" })`
- Use `sftpConfig` fixture or `getSftpConfigForWorker(testInfo.parallelIndex)`
- Pass config to all SFTP helper function calls

### Task 7: Update documentation

**Files:**

- Modify: `docs/plans/2026-01-02-sftp-test-wait-helpers.md`

Remove references to `--workers=1` requirement.

### Task 8: Run full E2E suite

Run: `BYPASS_RATE_LIMIT=true pnpm run test:e2e --project=chromium`

Verify all SFTP tests pass with parallel workers (should use multiple containers).

---

## Summary

| Aspect           | Before           | After                                |
| ---------------- | ---------------- | ------------------------------------ |
| Containers       | 1 shared         | 8 isolated (per-worker)              |
| Port range       | 2222             | 2222-2229                            |
| Parallelism      | Serial only      | Full parallel (up to 8 workers)      |
| Worker mapping   | N/A              | `testInfo.parallelIndex` → container |
| Helper functions | Hardcoded config | Optional config parameter            |
| Retry isolation  | Race conditions  | Same container, clean state          |
| CI behavior      | No change        | No change (still 1 worker)           |

## Key Design Decisions

1. **`parallelIndex` over `workerIndex`**: `parallelIndex` is bounded by worker count, while `workerIndex` can exceed container count due to worker restarts.

2. **YAML anchors**: Reduces docker-compose.yml duplication from 160+ lines to ~40 lines.

3. **`start_period` in health checks**: Allows SFTP daemon 5 seconds to initialize before health checks can fail.

4. **Optional config parameter**: Maintains backward compatibility - existing code using `sftpTestConfig` continues to work.

5. **Worker count capping**: Global setup caps workers to MAX_WORKERS (8) to prevent container overflow on high-core machines.
