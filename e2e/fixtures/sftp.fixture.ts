/**
 * SFTP fixtures for E2E tests.
 * Provides per-worker SFTP containers for parallel test execution.
 */

import Client from "ssh2-sftp-client";

const BASE_PORT = 2222;
const MAX_WORKERS = 8;

/** SFTP test server configuration. */
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
        `Ensure Playwright workers <= ${MAX_WORKERS}.`
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

/**
 * Creates an SFTP client connected to the specified server.
 *
 * @param config - SFTP connection configuration
 * @returns Connected SFTP client
 */
async function getClient(config: SftpTestConfig): Promise<Client> {
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
 * Verifies if a path exists on the SFTP server.
 *
 * @param path - Path to check
 * @param config - SFTP connection configuration
 * @returns True if path exists
 */
export async function verifySftpFileExists(
  path: string,
  config: SftpTestConfig
): Promise<boolean> {
  const sftp = await getClient(config);
  try {
    const result = await sftp.exists(path);
    return result !== false;
  } finally {
    await sftp.end();
  }
}

/**
 * Creates a test file on the SFTP server.
 *
 * @param path - Path to create file at
 * @param content - File content
 * @param config - SFTP connection configuration
 */
export async function createSftpTestFile(
  path: string,
  content: string,
  config: SftpTestConfig
): Promise<void> {
  const sftp = await getClient(config);
  try {
    await sftp.put(Buffer.from(content), path);
  } finally {
    await sftp.end();
  }
}

/**
 * Creates a test directory on the SFTP server.
 *
 * @param path - Path to create directory at
 * @param config - SFTP connection configuration
 */
export async function createSftpTestDir(
  path: string,
  config: SftpTestConfig
): Promise<void> {
  const sftp = await getClient(config);
  try {
    await sftp.mkdir(path, true);
  } finally {
    await sftp.end();
  }
}

/**
 * Deletes a path from the SFTP server.
 *
 * @param path - Path to delete
 * @param config - SFTP connection configuration
 */
export async function deleteSftpTestPath(
  path: string,
  config: SftpTestConfig
): Promise<void> {
  const sftp = await getClient(config);
  try {
    const type = await sftp.exists(path);
    if (type === "d") {
      await sftp.rmdir(path, true);
    } else if (type) {
      await sftp.delete(path);
    }
  } finally {
    await sftp.end();
  }
}

/**
 * Lists contents of a directory on the SFTP server.
 *
 * @param path - Path to list
 * @param config - SFTP connection configuration
 * @returns Array of file/directory names
 */
export async function listSftpDir(
  path: string,
  config: SftpTestConfig
): Promise<string[]> {
  const sftp = await getClient(config);
  try {
    const files = await sftp.list(path);
    return files.map((f) => f.name);
  } finally {
    await sftp.end();
  }
}

/**
 * Reads file content from SFTP server.
 *
 * @param path - Path to file
 * @param config - SFTP connection configuration
 * @returns File content as string
 */
export async function readSftpFile(
  path: string,
  config: SftpTestConfig
): Promise<string> {
  const sftp = await getClient(config);
  try {
    const buffer = (await sftp.get(path)) as Buffer;
    return buffer.toString("utf-8");
  } finally {
    await sftp.end();
  }
}

/**
 * Cleans all files from the SFTP test directory.
 *
 * @param config - SFTP connection configuration
 */
export async function cleanSftpTestDir(config: SftpTestConfig): Promise<void> {
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
 * Waits for the SFTP server to be ready.
 *
 * @param config - SFTP connection configuration
 * @param maxAttempts - Maximum connection attempts
 * @param delayMs - Delay between attempts in milliseconds
 */
export async function waitForSftpReady(
  config: SftpTestConfig,
  maxAttempts = 30,
  delayMs = 1000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const sftp = await getClient(config);
      await sftp.list(config.basePath);
      await sftp.end();
      return;
    } catch {
      if (i === maxAttempts - 1) {
        throw new Error(
          `SFTP server on port ${config.port} not ready after ${maxAttempts} attempts`
        );
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Options for wait helper functions. */
interface WaitOptions {
  /** Maximum time to wait in milliseconds. */
  timeoutMs?: number;
  /** Interval between polls in milliseconds. */
  intervalMs?: number;
}

const DEFAULT_WAIT_OPTIONS: Required<WaitOptions> = {
  timeoutMs: 30000,
  intervalMs: 500,
};

/**
 * Polls until a path exists on the SFTP server or timeout.
 *
 * @param path - Path to check for existence
 * @param config - SFTP connection configuration
 * @param options - Wait options (timeoutMs, intervalMs)
 * @throws Error if path does not exist after timeout
 */
export async function waitForSftpPathExists(
  path: string,
  config: SftpTestConfig,
  options?: WaitOptions
): Promise<void> {
  const { timeoutMs, intervalMs } = { ...DEFAULT_WAIT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const exists = await verifySftpFileExists(path, config);
    if (exists) {
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Timeout waiting for path to exist: ${path} (waited ${timeoutMs}ms)`
  );
}

/**
 * Polls until a path is deleted from the SFTP server or timeout.
 *
 * @param path - Path to check for deletion
 * @param config - SFTP connection configuration
 * @param options - Wait options (timeoutMs, intervalMs)
 * @throws Error if path still exists after timeout
 */
export async function waitForSftpPathDeleted(
  path: string,
  config: SftpTestConfig,
  options?: WaitOptions
): Promise<void> {
  const { timeoutMs, intervalMs } = { ...DEFAULT_WAIT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const exists = await verifySftpFileExists(path, config);
    if (!exists) {
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Timeout waiting for path to be deleted: ${path} (waited ${timeoutMs}ms)`
  );
}

/**
 * Polls until a directory contains a specific item or timeout.
 *
 * @param dirPath - Directory path to check
 * @param itemName - Name of the item to look for
 * @param config - SFTP connection configuration
 * @param options - Wait options (timeoutMs, intervalMs)
 * @throws Error if directory does not contain item after timeout
 */
export async function waitForSftpDirContains(
  dirPath: string,
  itemName: string,
  config: SftpTestConfig,
  options?: WaitOptions
): Promise<void> {
  const { timeoutMs, intervalMs } = { ...DEFAULT_WAIT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const items = await listSftpDir(dirPath, config);
      if (items.includes(itemName)) {
        return;
      }
    } catch {
      // Directory might not exist yet, continue polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Timeout waiting for directory "${dirPath}" to contain "${itemName}" (waited ${timeoutMs}ms)`
  );
}

/**
 * Polls until a directory does not contain a specific item or timeout.
 *
 * @param dirPath - Directory path to check
 * @param itemName - Name of the item to check for absence
 * @param config - SFTP connection configuration
 * @param options - Wait options (timeoutMs, intervalMs)
 * @throws Error if directory still contains item after timeout
 */
export async function waitForSftpDirNotContains(
  dirPath: string,
  itemName: string,
  config: SftpTestConfig,
  options?: WaitOptions
): Promise<void> {
  const { timeoutMs, intervalMs } = { ...DEFAULT_WAIT_OPTIONS, ...options };
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const items = await listSftpDir(dirPath, config);
      if (!items.includes(itemName)) {
        return;
      }
    } catch {
      // Directory doesn't exist, so it doesn't contain the item
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(
    `Timeout waiting for directory "${dirPath}" to not contain "${itemName}" (waited ${timeoutMs}ms)`
  );
}
