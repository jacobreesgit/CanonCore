/**
 * SFTP client service for connecting to user SFTP servers.
 * Wraps ssh2-sftp-client with connection pooling and mutex locks.
 */

import Client from "ssh2-sftp-client";
import { decryptCredential } from "@/lib/crypto";
import { withTimeout } from "@/lib/sftp-utils";
import type { SftpConnection } from "@prisma/client";

// Connection pool with mutex locks to prevent race conditions
const connectionPool = new Map<string, { client: Client; lastUsed: number }>();
const connectionLocks = new Map<string, Promise<Client>>();
const POOL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const OPERATION_TIMEOUT_MS = 30 * 1000; // 30 seconds per operation

/**
 * Gets or creates an SFTP connection from the pool with mutex lock.
 * Prevents race conditions when multiple requests try to create connections.
 *
 * @param connection - SFTP connection configuration
 * @returns Connected SFTP client
 */
export async function getConnection(
  connection: SftpConnection
): Promise<Client> {
  // Check if connection exists in pool
  const pooled = connectionPool.get(connection.id);
  if (pooled) {
    pooled.lastUsed = Date.now();
    return pooled.client;
  }

  // Check if connection is being created (mutex)
  const existingLock = connectionLocks.get(connection.id);
  if (existingLock) {
    return existingLock;
  }

  // Create new connection with lock
  const connectionPromise = (async () => {
    try {
      const client = new Client();
      const credential = decryptCredential(connection.encryptedCredential);

      await withTimeout(
        client.connect({
          host: connection.host,
          port: connection.port,
          username: connection.username,
          ...(connection.authType === "PASSWORD"
            ? { password: credential }
            : { privateKey: credential }),
          readyTimeout: 10000,
          retries: 2,
          retry_minTimeout: 2000,
        }),
        15000,
        "SFTP connection"
      );

      connectionPool.set(connection.id, { client, lastUsed: Date.now() });
      return client;
    } finally {
      connectionLocks.delete(connection.id);
    }
  })();

  connectionLocks.set(connection.id, connectionPromise);
  return connectionPromise;
}

/**
 * Closes and removes a connection from the pool.
 *
 * @param connectionId - ID of connection to close
 */
export async function closeConnection(connectionId: string): Promise<void> {
  const pooled = connectionPool.get(connectionId);
  if (pooled) {
    await pooled.client.end();
    connectionPool.delete(connectionId);
  }
}

/**
 * Uploads a file to the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param source - Local file path or Buffer
 * @param remotePath - Destination path on SFTP server
 */
export async function uploadFile(
  connection: SftpConnection,
  source: string | Buffer,
  remotePath: string
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.put(source, remotePath),
    OPERATION_TIMEOUT_MS,
    "upload file"
  );
}

/**
 * Downloads a file as a Buffer.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path on SFTP server
 * @returns File contents as Buffer
 */
export async function downloadFileBuffer(
  connection: SftpConnection,
  remotePath: string
): Promise<Buffer> {
  const client = await getConnection(connection);
  return withTimeout(
    client.get(remotePath) as Promise<Buffer>,
    OPERATION_TIMEOUT_MS,
    "download file"
  );
}

/**
 * Deletes a file from the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to delete
 */
export async function deleteFile(
  connection: SftpConnection,
  remotePath: string
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.delete(remotePath),
    OPERATION_TIMEOUT_MS,
    "delete file"
  );
}

/**
 * Renames/moves a file or directory.
 *
 * @param connection - SFTP connection configuration
 * @param oldPath - Current path
 * @param newPath - New path
 */
export async function rename(
  connection: SftpConnection,
  oldPath: string,
  newPath: string
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.rename(oldPath, newPath),
    OPERATION_TIMEOUT_MS,
    "rename"
  );
}

/**
 * Creates a directory on the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to create
 * @param recursive - Create parent directories if needed
 */
export async function createDirectory(
  connection: SftpConnection,
  remotePath: string,
  recursive = true
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.mkdir(remotePath, recursive),
    OPERATION_TIMEOUT_MS,
    "create directory"
  );
}

/**
 * Removes a directory from the remote server.
 *
 * @param connection - SFTP connection configuration
 * @param remotePath - Path to remove
 */
export async function removeDirectory(
  connection: SftpConnection,
  remotePath: string
): Promise<void> {
  const client = await getConnection(connection);
  await withTimeout(
    client.rmdir(remotePath, true),
    OPERATION_TIMEOUT_MS,
    "remove directory"
  );
}

// Cleanup stale connections periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, pooled] of connectionPool.entries()) {
    if (now - pooled.lastUsed > POOL_TIMEOUT_MS) {
      pooled.client.end().catch(() => {});
      connectionPool.delete(id);
    }
  }
}, 60000);
