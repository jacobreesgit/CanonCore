/**
 * Server actions for SFTP connection management.
 * Provides CRUD operations with encrypted credential storage.
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptCredential, decryptCredential } from "@/lib/crypto";
import { sftpConnectionSchema } from "@/lib/validations";
import { sanitizePath, validateFileName, withTimeout } from "@/lib/sftp-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  closeConnection,
  createDirectory,
  removeDirectory,
  getConnection,
} from "@/lib/sftp-client";
import {
  getFileTypeByExtension,
  getMimeTypeByExtension,
} from "@/lib/file-type-utils";
import type { SftpConnection } from "@prisma/client";
import type { Item, ItemWithArtwork } from "@/lib/types";
import Client from "ssh2-sftp-client";
import { logger } from "@/lib/logger";
import { buildDescendantCounter } from "@/lib/item-utils";

/** Result type for server actions. */
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Gets the current authenticated user ID.
 *
 * @returns User ID
 * @throws If not authenticated
 */
async function requireAuth(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

/**
 * Gets all SFTP connections for the current user.
 *
 * @returns List of connections (without decrypted credentials)
 */
export async function getSftpConnections(): Promise<
  ActionResult<Omit<SftpConnection, "encryptedCredential">[]>
> {
  try {
    const userId = await requireAuth();

    const connections = await prisma.sftpConnection.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        basePath: true,
        isActive: true,
        lastConnectedAt: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: connections as Omit<SftpConnection, "encryptedCredential">[],
    };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Get connections error");
    return { success: false, error: "Failed to load connections" };
  }
}

/**
 * Gets items for a specific connection with artwork thumbnails.
 *
 * @param connectionId - SFTP connection ID
 * @param parentId - Parent item ID (null for root level)
 * @returns Items belonging to the connection with artworkId
 */
export async function getItemsByConnection(
  connectionId: string,
  parentId: string | null
): Promise<ActionResult<ItemWithArtwork[]>> {
  try {
    const userId = await requireAuth();

    // Verify connection ownership
    const connection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    // Fetch all items for this connection for descendant count calculation
    const allConnectionItems = await prisma.item.findMany({
      where: { userId, connectionId },
      select: { id: true, parentId: true },
    });

    // Use helper to build descendant counter (DRY)
    const countDescendants = buildDescendantCounter(allConnectionItems);

    // Fetch items at current level with files
    const items = await prisma.item.findMany({
      where: {
        userId,
        connectionId,
        parentId,
      },
      orderBy: { order: "asc" },
      include: {
        files: {
          select: { id: true, fileType: true, isPrimary: true },
        },
      },
    });

    // Transform to ItemWithArtwork with file counts and descendant count
    const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => {
      // Find primary artwork, or first artwork if no primary
      const primaryArtwork = item.files.find(
        (f) => f.fileType === "ARTWORK" && f.isPrimary
      );
      const firstArtwork = item.files.find((f) => f.fileType === "ARTWORK");
      const artworkId = primaryArtwork?.id ?? firstArtwork?.id ?? null;

      // Calculate file counts by type
      const fileCounts = {
        media: item.files.filter((f) => f.fileType === "MEDIA").length,
        artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
        subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
      };

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        order: item.order,
        depth: item.depth,
        userId: item.userId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        sftpPath: item.sftpPath,
        sftpModifiedAt: item.sftpModifiedAt,
        connectionId: item.connectionId,
        artworkId,
        connectionName: connection.name,
        fileCounts,
        childCount: countDescendants(item.id),
      };
    });

    return { success: true, data: itemsWithArtwork };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Get items by connection error");
    return { success: false, error: "Failed to load items" };
  }
}

/**
 * Fetches ALL items for a connection with artwork thumbnails.
 * Returns full hierarchy (all levels) for inline tree display.
 *
 * @param connectionId - SFTP connection ID to filter by
 * @returns All items for connection with artworkId or error
 */
export async function getAllItemsByConnection(
  connectionId: string
): Promise<ActionResult<ItemWithArtwork[]>> {
  try {
    const userId = await requireAuth();

    // Verify connection ownership
    const connection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    // Fetch all items for this connection for descendant count calculation
    const allConnectionItems = await prisma.item.findMany({
      where: { userId, connectionId },
      select: { id: true, parentId: true },
    });

    // Use helper to build descendant counter (DRY)
    const countDescendants = buildDescendantCounter(allConnectionItems);

    // Fetch ALL items for this connection
    const items = await prisma.item.findMany({
      where: { userId, connectionId },
      orderBy: [{ depth: "asc" }, { order: "asc" }],
      include: {
        files: {
          select: { id: true, fileType: true, isPrimary: true },
        },
        connection: {
          select: { name: true },
        },
      },
    });

    const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => {
      const primaryArtwork = item.files.find(
        (f) => f.fileType === "ARTWORK" && f.isPrimary
      );
      const firstArtwork = item.files.find((f) => f.fileType === "ARTWORK");
      const artworkId = primaryArtwork?.id ?? firstArtwork?.id ?? null;

      const fileCounts = {
        media: item.files.filter((f) => f.fileType === "MEDIA").length,
        artwork: item.files.filter((f) => f.fileType === "ARTWORK").length,
        subtitles: item.files.filter((f) => f.fileType === "SUBTITLE").length,
      };

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        order: item.order,
        depth: item.depth,
        userId: item.userId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        sftpPath: item.sftpPath,
        sftpModifiedAt: item.sftpModifiedAt,
        connectionId: item.connectionId,
        artworkId,
        connectionName: item.connection?.name ?? null,
        fileCounts,
        childCount: countDescendants(item.id),
      };
    });

    return { success: true, data: itemsWithArtwork };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Get all items by connection error");
    return { success: false, error: "Failed to fetch items" };
  }
}

/**
 * Gets a single SFTP connection by ID.
 *
 * @param connectionId - Connection ID
 * @returns Connection (without decrypted credentials)
 */
export async function getSftpConnection(
  connectionId: string
): Promise<ActionResult<Omit<SftpConnection, "encryptedCredential">>> {
  try {
    const userId = await requireAuth();

    const connection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
      select: {
        id: true,
        userId: true,
        name: true,
        host: true,
        port: true,
        username: true,
        authType: true,
        basePath: true,
        isActive: true,
        lastConnectedAt: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    return {
      success: true,
      data: connection as Omit<SftpConnection, "encryptedCredential">,
    };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Get connection error");
    return { success: false, error: "Failed to load connection" };
  }
}

/**
 * Creates a new SFTP connection with encrypted credentials.
 *
 * @param data - Connection configuration
 * @returns Created connection ID
 */
export async function createSftpConnection(data: {
  name: string;
  host: string;
  port?: number;
  username: string;
  authType: "PASSWORD" | "PRIVATE_KEY";
  credential: string;
  basePath?: string;
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    // Rate limit check
    const rateLimitResult = await checkRateLimit("sftpCreate");
    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }

    const userId = await requireAuth();

    // Validate input
    const validated = sftpConnectionSchema.parse(data);

    // Check for duplicate name
    const existing = await prisma.sftpConnection.findFirst({
      where: { userId, name: validated.name },
    });
    if (existing) {
      return {
        success: false,
        error: "A connection with this name already exists",
      };
    }

    // Encrypt credential
    const encryptedCredential = encryptCredential(validated.credential);

    // Encrypt WebDAV password if provided
    const encryptedWebdavPassword = data.webdavPassword
      ? encryptCredential(data.webdavPassword)
      : null;

    // Create connection
    const connection = await prisma.sftpConnection.create({
      data: {
        userId,
        name: validated.name,
        host: validated.host,
        port: validated.port,
        username: validated.username,
        authType: validated.authType,
        encryptedCredential,
        basePath: validated.basePath,
        webdavUrl: data.webdavUrl || null,
        webdavUsername: data.webdavUsername || null,
        encryptedWebdavPassword,
      },
    });

    revalidatePath("/my-items/connections");
    return { success: true, data: { id: connection.id } };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Create connection error");
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        success: false,
        error: "A connection with this name already exists",
      };
    }
    return { success: false, error: "Failed to create connection" };
  }
}

/**
 * Updates an existing SFTP connection.
 *
 * @param connectionId - Connection ID to update
 * @param data - Updated configuration
 */
export async function updateSftpConnection(
  connectionId: string,
  data: {
    name?: string;
    host?: string;
    port?: number;
    username?: string;
    authType?: "PASSWORD" | "PRIVATE_KEY";
    credential?: string;
    basePath?: string;
    webdavUrl?: string | null;
    webdavUsername?: string | null;
    webdavPassword?: string;
  }
): Promise<ActionResult> {
  try {
    const userId = await requireAuth();

    // Verify ownership
    const existing = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!existing) {
      return { success: false, error: "Connection not found" };
    }

    // Check for duplicate name if changing
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.sftpConnection.findFirst({
        where: { userId, name: data.name, NOT: { id: connectionId } },
      });
      if (duplicate) {
        return {
          success: false,
          error: "A connection with this name already exists",
        };
      }
    }

    // Close existing pooled connection if credentials changed
    if (data.credential || data.host || data.port || data.username) {
      await closeConnection(connectionId);
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (data.name) updateData.name = data.name;
    if (data.host) updateData.host = data.host;
    if (data.port) updateData.port = data.port;
    if (data.username) updateData.username = data.username;
    if (data.authType) updateData.authType = data.authType;
    if (data.basePath !== undefined) updateData.basePath = data.basePath;
    if (data.credential) {
      updateData.encryptedCredential = encryptCredential(data.credential);
    }
    // WebDAV fields - allow null to clear
    if (data.webdavUrl !== undefined) updateData.webdavUrl = data.webdavUrl;
    if (data.webdavUsername !== undefined)
      updateData.webdavUsername = data.webdavUsername;
    if (data.webdavPassword) {
      updateData.encryptedWebdavPassword = encryptCredential(
        data.webdavPassword
      );
    }

    await prisma.sftpConnection.update({
      where: { id: connectionId },
      data: updateData,
    });

    revalidatePath("/my-items/connections");
    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Update connection error");
    return { success: false, error: "Failed to update connection" };
  }
}

/**
 * Deletes an SFTP connection and closes active sessions.
 *
 * @param connectionId - Connection ID to delete
 */
export async function deleteSftpConnection(
  connectionId: string
): Promise<ActionResult> {
  try {
    const userId = await requireAuth();

    // Verify ownership
    const existing = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!existing) {
      return { success: false, error: "Connection not found" };
    }

    // Close pooled connection
    await closeConnection(connectionId);

    // Delete from database (items will have connectionId set to null via onDelete: SetNull)
    await prisma.sftpConnection.delete({
      where: { id: connectionId },
    });

    revalidatePath("/my-items/connections");
    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Delete connection error");
    return { success: false, error: "Failed to delete connection" };
  }
}

/**
 * Tests an SFTP connection and measures latency.
 *
 * @param connectionId - Connection ID to test
 * @returns Latency in milliseconds
 */
export async function testSftpConnection(
  connectionId: string
): Promise<ActionResult<{ latencyMs: number }>> {
  try {
    // Rate limit check
    const rateLimitResult = await checkRateLimit("sftpTest");
    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }

    const userId = await requireAuth();

    // Get connection with credentials
    const connection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    // Test connection
    const start = Date.now();
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
      }),
      15000,
      "SFTP connection test"
    );

    // List root to verify access
    await client.list(connection.basePath);
    await client.end();

    const latencyMs = Date.now() - start;

    // Update last connected time
    await prisma.sftpConnection.update({
      where: { id: connectionId },
      data: { lastConnectedAt: new Date(), lastError: null },
    });

    revalidatePath("/my-items/connections");
    return { success: true, data: { latencyMs } };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Test connection error");

    // Update error state
    try {
      await prisma.sftpConnection.update({
        where: { id: connectionId },
        data: {
          lastError:
            error instanceof Error ? error.message : "Connection failed",
        },
      });
      revalidatePath("/my-items/connections");
    } catch {
      // Ignore update error
    }

    return {
      success: false,
      error: "Connection failed. Please check your credentials.",
    };
  }
}

/**
 * Creates an item on the SFTP server and in the database.
 *
 * @param connectionId - Connection ID
 * @param parentItemId - Parent item ID (null for root)
 * @param name - Item name
 */
export async function createSftpItem(
  connectionId: string,
  parentItemId: string | null,
  name: string
): Promise<ActionResult<Item>> {
  try {
    const userId = await requireAuth();

    // Validate filename
    validateFileName(name);

    // Get connection
    const connection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    // Get parent path if exists
    let parentPath = connection.basePath;
    let depth = 0;
    if (parentItemId) {
      const parent = await prisma.item.findFirst({
        where: { id: parentItemId, userId, connectionId },
      });
      if (!parent || !parent.sftpPath) {
        return { success: false, error: "Parent item not found" };
      }
      parentPath = parent.sftpPath;
      depth = parent.depth + 1;
    }

    // Sanitize and build full path
    const fullPath = sanitizePath(parentPath, name);

    // Create on SFTP server
    await createDirectory(connection, fullPath);

    // Get next order
    const maxOrder = await prisma.item.aggregate({
      where: { userId, parentId: parentItemId },
      _max: { order: true },
    });

    // Create in database
    const item = await prisma.item.create({
      data: {
        name,
        userId,
        parentId: parentItemId,
        connectionId,
        sftpPath: fullPath,
        order: (maxOrder._max.order ?? -1) + 1,
        depth,
      },
    });

    revalidatePath("/my-items");
    return {
      success: true,
      data: {
        id: item.id,
        name: item.name,
        description: item.description,
        parentId: item.parentId,
        connectionId: item.connectionId,
        sftpPath: item.sftpPath,
        order: item.order,
        depth: item.depth,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        userId: item.userId,
        sftpModifiedAt: null,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Create item error");
    return { success: false, error: "Failed to create item" };
  }
}

/**
 * Deletes an item from SFTP server and database.
 *
 * @param itemId - Item ID to delete
 */
export async function deleteSftpItem(itemId: string): Promise<ActionResult> {
  try {
    const userId = await requireAuth();

    // Get item with connection
    const item = await prisma.item.findFirst({
      where: { id: itemId, userId },
      include: { connection: true },
    });
    if (!item) {
      return { success: false, error: "Item not found" };
    }

    // Delete item from SFTP if connected
    if (item.connection && item.sftpPath) {
      try {
        await removeDirectory(item.connection, item.sftpPath);
      } catch (sftpError) {
        logger.error({ err: sftpError }, "[SFTP] Delete from server failed");
        // Continue to delete from DB even if SFTP delete fails
      }
    }

    // Delete from database (children and files cascade deleted)
    await prisma.item.delete({
      where: { id: itemId },
    });

    revalidatePath("/my-items");
    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Delete item error");
    return { success: false, error: "Failed to delete item" };
  }
}

/** Sync result details */
export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
}

/** Maximum sync limits for security */
const SYNC_MAX_DEPTH = 10;
const SYNC_MAX_ENTRIES = 10000;

/**
 * Syncs files from SFTP server to database.
 * Creates Items for folders and ItemFiles for files.
 *
 * @param connectionId - Connection ID to sync
 * @param options - Optional settings
 * @param options.skipRevalidate - If true, skip revalidating paths (for batch operations)
 * @returns Sync statistics
 */
export async function syncFromSftp(
  connectionId: string,
  options?: { skipRevalidate?: boolean }
): Promise<ActionResult<SyncResult>> {
  try {
    // Rate limit check
    const rateLimitResult = await checkRateLimit("sftpSync");
    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }

    const userId = await requireAuth();

    // Get connection with credentials
    const connection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId, userId },
    });
    if (!connection) {
      return { success: false, error: "Connection not found" };
    }

    // Get pooled SFTP connection
    const client = await getConnection(connection);

    // Recursively list all entries from SFTP
    const remoteEntries: Array<{
      path: string;
      name: string;
      type: "d" | "-" | "l";
      size: number;
      modifyTime: number;
      depth: number;
      parentPath: string;
    }> = [];

    // Track directories that failed to list for logging
    const failedDirs: string[] = [];

    async function listRecursive(dirPath: string, depth: number) {
      if (depth > SYNC_MAX_DEPTH || remoteEntries.length >= SYNC_MAX_ENTRIES) {
        return;
      }

      let entries;
      try {
        entries = await client.list(dirPath);
      } catch (listError) {
        // Log the error but continue with other directories
        logger.warn(
          { err: listError, dirPath },
          "[SFTP] Failed to list directory"
        );
        failedDirs.push(dirPath);
        return;
      }

      for (const entry of entries) {
        if (entry.name === "." || entry.name === "..") continue;

        const entryPath = `${dirPath}/${entry.name}`.replace(/\/+/g, "/");

        remoteEntries.push({
          path: entryPath,
          name: entry.name,
          type: entry.type,
          size: entry.size,
          modifyTime: entry.modifyTime,
          depth,
          parentPath: dirPath,
        });

        if (entry.type === "d" && depth < SYNC_MAX_DEPTH) {
          await listRecursive(entryPath, depth + 1);
        }
      }
    }

    await listRecursive(connection.basePath, 0);

    // Log if any directories failed
    if (failedDirs.length > 0) {
      logger.warn(
        { count: failedDirs.length },
        "[SFTP] Sync completed with inaccessible directories"
      );
    }

    // Separate folders and files
    const remoteFolders = remoteEntries.filter((e) => e.type === "d");
    const remoteFiles = remoteEntries.filter((e) => e.type !== "d");

    // Get existing items for this connection
    const existingItems = await prisma.item.findMany({
      where: { userId, connectionId },
      select: {
        id: true,
        sftpPath: true,
        sftpModifiedAt: true,
      },
    });

    const existingByPath = new Map(
      existingItems.filter((i) => i.sftpPath).map((i) => [i.sftpPath!, i])
    );
    const remoteFolderPaths = new Set(remoteFolders.map((f) => f.path));

    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Process folders in order (parents before children)
    const sortedFolders = remoteFolders.sort((a, b) => a.depth - b.depth);

    // Map paths to created item IDs for parent lookups
    const pathToItemId = new Map<string, string>();

    // Load existing path->id mapping
    for (const item of existingItems) {
      if (item.sftpPath) {
        pathToItemId.set(item.sftpPath, item.id);
      }
    }

    // Create/update folders as Items
    for (const folder of sortedFolders) {
      const existing = existingByPath.get(folder.path);

      if (!existing) {
        // New folder - create Item
        const parentId = pathToItemId.get(folder.parentPath) ?? null;

        const maxOrder = await prisma.item.aggregate({
          where: { userId, parentId },
          _max: { order: true },
        });

        const newItem = await prisma.item.create({
          data: {
            name: folder.name,
            userId,
            parentId,
            connectionId,
            sftpPath: folder.path,
            sftpModifiedAt: new Date(folder.modifyTime),
            order: (maxOrder._max.order ?? -1) + 1,
            depth: folder.depth,
          },
        });

        pathToItemId.set(folder.path, newItem.id);
        created++;
      } else {
        // Existing folder - check for updates
        const remoteMtime = new Date(folder.modifyTime);
        const localMtime = existing.sftpModifiedAt;

        if (!localMtime || remoteMtime.getTime() !== localMtime.getTime()) {
          await prisma.item.update({
            where: { id: existing.id },
            data: {
              sftpModifiedAt: remoteMtime,
            },
          });
          updated++;
        }
      }
    }

    // Get existing ItemFiles for this connection's items
    const connectionItemIds = await prisma.item.findMany({
      where: { connectionId },
      select: { id: true },
    });
    const itemIdSet = new Set(connectionItemIds.map((i) => i.id));

    const existingFiles = await prisma.itemFile.findMany({
      where: { itemId: { in: Array.from(itemIdSet) } },
      select: {
        id: true,
        itemId: true,
        sftpPath: true,
        sftpModifiedAt: true,
      },
    });

    const existingFilesByPath = new Map(
      existingFiles.map((f) => [f.sftpPath, f])
    );
    const remoteFilePaths = new Set(remoteFiles.map((f) => f.path));

    // Create/update ItemFiles for remote files
    for (const file of remoteFiles) {
      const fileType = getFileTypeByExtension(file.name);

      // Skip files with unknown types
      if (!fileType) continue;

      // Find parent item by path
      const parentItemId = pathToItemId.get(file.parentPath);
      if (!parentItemId) {
        // Parent folder not synced yet, skip
        continue;
      }

      const existing = existingFilesByPath.get(file.path);

      if (!existing) {
        // New file - create ItemFile
        await prisma.itemFile.create({
          data: {
            itemId: parentItemId,
            filename: file.name,
            sftpPath: file.path,
            fileType,
            mimeType: getMimeTypeByExtension(file.name),
            size: BigInt(file.size),
            sftpModifiedAt: new Date(file.modifyTime),
          },
        });
        created++;
      } else {
        // Existing file - check for updates
        const remoteMtime = new Date(file.modifyTime);
        const localMtime = existing.sftpModifiedAt;

        if (!localMtime || remoteMtime.getTime() !== localMtime.getTime()) {
          await prisma.itemFile.update({
            where: { id: existing.id },
            data: {
              size: BigInt(file.size),
              sftpModifiedAt: remoteMtime,
              mimeType: getMimeTypeByExtension(file.name),
            },
          });
          updated++;
        }
      }
    }

    // Delete ItemFiles that no longer exist on server
    for (const file of existingFiles) {
      if (!remoteFilePaths.has(file.sftpPath)) {
        await prisma.itemFile.delete({
          where: { id: file.id },
        });
        deleted++;
      }
    }

    // Delete items that no longer exist on server
    for (const item of existingItems) {
      if (item.sftpPath && !remoteFolderPaths.has(item.sftpPath)) {
        await prisma.item.delete({
          where: { id: item.id },
        });
        deleted++;
      }
    }

    // Update connection last sync time
    await prisma.sftpConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), lastError: null },
    });

    if (!options?.skipRevalidate) {
      revalidatePath("/my-items");
      revalidatePath("/my-items/connections");
    }

    return {
      success: true,
      data: { created, updated, deleted },
    };
  } catch (error) {
    logger.error({ err: error }, "[SFTP] Sync error");

    // Update error state
    try {
      await prisma.sftpConnection.update({
        where: { id: connectionId },
        data: {
          lastError: error instanceof Error ? error.message : "Sync failed",
        },
      });
      if (!options?.skipRevalidate) {
        revalidatePath("/my-items/connections");
      }
    } catch {
      // Ignore update error
    }

    return { success: false, error: "Failed to sync from SFTP" };
  }
}

/** Result for syncing all connections */
export interface SyncAllResult {
  totalConnections: number;
  successfulSyncs: number;
  failedSyncs: number;
  results: Array<{
    connectionId: string;
    connectionName: string;
    success: boolean;
    created: number;
    updated: number;
    deleted: number;
    error?: string;
  }>;
}

/**
 * Syncs all SFTP connections for the current user.
 * Processes connections sequentially with console progress logging.
 *
 * @returns Aggregated sync results
 */
export async function syncAllConnections(): Promise<
  ActionResult<SyncAllResult>
> {
  try {
    // Rate limit check
    const rateLimitResult = await checkRateLimit("sftpSyncAll");
    if (rateLimitResult) {
      return { success: false, error: rateLimitResult.error };
    }

    const userId = await requireAuth();

    const connections = await prisma.sftpConnection.findMany({
      where: { userId, isActive: true },
      orderBy: { name: "asc" },
    });

    logger.info(
      { connectionCount: connections.length },
      "[SFTP Sync All] Starting sync"
    );

    const results: SyncAllResult["results"] = [];
    let successfulSyncs = 0;
    let failedSyncs = 0;

    for (const connection of connections) {
      logger.info(
        { connectionName: connection.name, connectionId: connection.id },
        "[SFTP Sync All] Syncing connection"
      );

      const startTime = Date.now();
      const syncResult = await syncFromSftp(connection.id, {
        skipRevalidate: true,
      });
      const duration = Date.now() - startTime;

      if (syncResult.success && syncResult.data) {
        const { created, updated, deleted } = syncResult.data;
        logger.info(
          {
            connectionName: connection.name,
            duration,
            created,
            updated,
            deleted,
          },
          "[SFTP Sync All] Connection sync completed"
        );
        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          success: true,
          created,
          updated,
          deleted,
        });
        successfulSyncs++;
      } else {
        const error =
          "error" in syncResult ? syncResult.error : "Unknown error";
        logger.error(
          { connectionName: connection.name, error },
          "[SFTP Sync All] Connection sync failed"
        );
        results.push({
          connectionId: connection.id,
          connectionName: connection.name,
          success: false,
          created: 0,
          updated: 0,
          deleted: 0,
          error,
        });
        failedSyncs++;
      }
    }

    logger.info(
      { successfulSyncs, totalConnections: connections.length },
      "[SFTP Sync All] Completed"
    );

    revalidatePath("/my-items");
    revalidatePath("/my-items/connections");

    return {
      success: true,
      data: {
        totalConnections: connections.length,
        successfulSyncs,
        failedSyncs,
        results,
      },
    };
  } catch (error) {
    logger.error({ err: error }, "[SFTP Sync All] Error");
    if (error instanceof Error && error.message === "Unauthorized") {
      return { success: false, error: "Unauthorized" };
    }
    return { success: false, error: "Failed to sync connections" };
  }
}

/** Result for syncing an item tree */
export interface SyncItemResult {
  itemId: string;
  itemName: string;
  created: number;
  updated: number;
  deleted: number;
}

/** CUID format validation regex */
const CUID_REGEX = /^c[a-z0-9]{24}$/;

/**
 * Syncs a specific item and all its descendants from SFTP.
 * Only syncs the subtree rooted at the given item.
 * Uses batch operations and transactions for performance and atomicity.
 *
 * @param itemId - Root item ID to sync
 * @returns Sync statistics for the item tree
 */
export async function syncItemTree(
  itemId: string
): Promise<ActionResult<SyncItemResult>> {
  try {
    // Validate itemId format
    if (!CUID_REGEX.test(itemId)) {
      return { success: false, error: "Invalid item ID format" };
    }

    const userId = await requireAuth();

    // Get item with connection
    const item = await prisma.item.findFirst({
      where: { id: itemId, userId },
      include: { connection: true },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    if (!item.connectionId || !item.sftpPath || !item.connection) {
      return { success: false, error: "Item is not connected to SFTP" };
    }

    logger.info(
      { itemName: item.name, sftpPath: item.sftpPath },
      "[SFTP Sync Item] Starting sync"
    );

    const startTime = Date.now();
    let created = 0;
    let updated = 0;
    let deleted = 0;

    // Get pooled SFTP connection
    const client = await getConnection(item.connection);

    // Recursively list entries from item's SFTP path
    const remoteEntries: Array<{
      path: string;
      name: string;
      type: "d" | "-" | "l";
      size: number;
      modifyTime: number;
      depth: number;
      parentPath: string;
    }> = [];

    const failedDirs: string[] = [];
    const baseDepth = item.depth;

    async function listRecursive(dirPath: string, depth: number) {
      if (depth > SYNC_MAX_DEPTH || remoteEntries.length >= SYNC_MAX_ENTRIES) {
        return;
      }

      let entries;
      try {
        entries = await client.list(dirPath);
      } catch (listError) {
        logger.warn(
          { err: listError, dirPath },
          "[SFTP Sync Item] Failed to list directory"
        );
        failedDirs.push(dirPath);
        return;
      }

      for (const entry of entries) {
        if (entry.name === "." || entry.name === "..") continue;

        const entryPath = `${dirPath}/${entry.name}`.replace(/\/+/g, "/");

        remoteEntries.push({
          path: entryPath,
          name: entry.name,
          type: entry.type,
          size: entry.size,
          modifyTime: entry.modifyTime,
          depth,
          parentPath: dirPath,
        });

        if (entry.type === "d" && depth < SYNC_MAX_DEPTH) {
          await listRecursive(entryPath, depth + 1);
        }
      }
    }

    await listRecursive(item.sftpPath, baseDepth + 1);

    if (failedDirs.length > 0) {
      logger.warn(
        { count: failedDirs.length },
        "[SFTP Sync Item] Completed with inaccessible directories"
      );
    }

    // Separate folders and files
    const remoteFolders = remoteEntries.filter((e) => e.type === "d");
    const remoteFiles = remoteEntries.filter((e) => e.type !== "d");

    // Get existing child items
    const existingItems = await prisma.item.findMany({
      where: {
        userId,
        connectionId: item.connectionId,
        sftpPath: { startsWith: item.sftpPath + "/" },
      },
      select: { id: true, sftpPath: true, sftpModifiedAt: true },
    });

    const existingByPath = new Map(
      existingItems.filter((i) => i.sftpPath).map((i) => [i.sftpPath!, i])
    );
    const remoteFolderPaths = new Set(remoteFolders.map((f) => f.path));

    // Map paths to item IDs
    const pathToItemId = new Map<string, string>();
    pathToItemId.set(item.sftpPath, item.id);
    for (const existingItem of existingItems) {
      if (existingItem.sftpPath) {
        pathToItemId.set(existingItem.sftpPath, existingItem.id);
      }
    }

    // Pre-compute max orders per parent to avoid N+1
    const orderCounters = new Map<string | null, number>();
    const existingMaxOrders = await prisma.item.groupBy({
      by: ["parentId"],
      where: { userId },
      _max: { order: true },
    });
    for (const row of existingMaxOrders) {
      orderCounters.set(row.parentId, (row._max.order ?? -1) + 1);
    }

    // Process folders (parents before children)
    const sortedFolders = remoteFolders.sort((a, b) => a.depth - b.depth);

    // Wrap all DB operations in transaction
    await prisma.$transaction(async (tx) => {
      // Create/update folders
      for (const folder of sortedFolders) {
        const existing = existingByPath.get(folder.path);

        if (!existing) {
          const parentId = pathToItemId.get(folder.parentPath) ?? item.id;
          const order = orderCounters.get(parentId) ?? 0;
          orderCounters.set(parentId, order + 1);

          const newItem = await tx.item.create({
            data: {
              name: folder.name,
              userId,
              parentId,
              connectionId: item.connectionId,
              sftpPath: folder.path,
              sftpModifiedAt: new Date(folder.modifyTime),
              order,
              depth: folder.depth,
            },
          });

          pathToItemId.set(folder.path, newItem.id);
          created++;
          logger.debug(
            { path: folder.path },
            "[SFTP Sync Item] Created folder"
          );
        } else {
          const remoteMtime = new Date(folder.modifyTime);
          if (
            !existing.sftpModifiedAt ||
            remoteMtime.getTime() !== existing.sftpModifiedAt.getTime()
          ) {
            await tx.item.update({
              where: { id: existing.id },
              data: { sftpModifiedAt: remoteMtime },
            });
            updated++;
          }
        }
      }

      // Get existing files
      const childItemIds = Array.from(pathToItemId.values());
      const existingFiles = await tx.itemFile.findMany({
        where: { itemId: { in: childItemIds } },
        select: {
          id: true,
          itemId: true,
          sftpPath: true,
          sftpModifiedAt: true,
        },
      });

      const existingFilesByPath = new Map(
        existingFiles.map((f) => [f.sftpPath, f])
      );
      const remoteFilePaths = new Set(remoteFiles.map((f) => f.path));

      // Create/update files
      for (const file of remoteFiles) {
        const fileType = getFileTypeByExtension(file.name);
        if (!fileType) continue;

        const parentItemId = pathToItemId.get(file.parentPath);
        if (!parentItemId) continue;

        const existing = existingFilesByPath.get(file.path);

        if (!existing) {
          await tx.itemFile.create({
            data: {
              itemId: parentItemId,
              filename: file.name,
              sftpPath: file.path,
              fileType,
              mimeType: getMimeTypeByExtension(file.name),
              size: BigInt(file.size),
              sftpModifiedAt: new Date(file.modifyTime),
            },
          });
          created++;
          logger.debug({ path: file.path }, "[SFTP Sync Item] Created file");
        } else {
          const remoteMtime = new Date(file.modifyTime);
          if (
            !existing.sftpModifiedAt ||
            remoteMtime.getTime() !== existing.sftpModifiedAt.getTime()
          ) {
            await tx.itemFile.update({
              where: { id: existing.id },
              data: {
                size: BigInt(file.size),
                sftpModifiedAt: remoteMtime,
                mimeType: getMimeTypeByExtension(file.name),
              },
            });
            updated++;
          }
        }
      }

      // Delete files that no longer exist
      for (const file of existingFiles) {
        if (!remoteFilePaths.has(file.sftpPath)) {
          await tx.itemFile.delete({ where: { id: file.id } });
          deleted++;
          logger.debug(
            { path: file.sftpPath },
            "[SFTP Sync Item] Deleted file"
          );
        }
      }

      // Delete items that no longer exist
      for (const existingItem of existingItems) {
        if (
          existingItem.sftpPath &&
          !remoteFolderPaths.has(existingItem.sftpPath)
        ) {
          await tx.item.delete({ where: { id: existingItem.id } });
          deleted++;
          logger.debug(
            { path: existingItem.sftpPath },
            "[SFTP Sync Item] Deleted item"
          );
        }
      }
    });

    const duration = Date.now() - startTime;
    logger.info(
      { itemName: item.name, duration, created, updated, deleted },
      "[SFTP Sync Item] Completed"
    );

    revalidatePath("/my-items");
    revalidatePath(`/my-items/${itemId}`);

    return {
      success: true,
      data: { itemId: item.id, itemName: item.name, created, updated, deleted },
    };
  } catch (error) {
    logger.error({ err: error }, "[SFTP Sync Item] Error");
    return { success: false, error: "Failed to sync item" };
  }
}
