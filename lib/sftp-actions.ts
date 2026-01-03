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
import {
  closeConnection,
  createDirectory,
  removeDirectory,
  rename as sftpRename,
  getConnection,
} from "@/lib/sftp-client";
import {
  getFileTypeByExtension,
  getMimeTypeByExtension,
} from "@/lib/file-type-utils";
import type { SftpConnection } from "@prisma/client";
import type { Item, ItemWithArtwork } from "@/lib/types";
import Client from "ssh2-sftp-client";

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
    console.error("[SFTP] Get connections error:", error);
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

    const items = await prisma.item.findMany({
      where: {
        userId,
        connectionId,
        parentId,
      },
      orderBy: { order: "asc" },
      include: {
        files: {
          where: { fileType: "ARTWORK" },
          take: 1,
          orderBy: { filename: "asc" },
          select: { id: true },
        },
      },
    });

    // Transform to ItemWithArtwork
    const itemsWithArtwork: ItemWithArtwork[] = items.map((item) => ({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      order: item.order,
      depth: item.depth,
      userId: item.userId,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      sftpPath: item.sftpPath,
      sftpModifiedAt: item.sftpModifiedAt,
      connectionId: item.connectionId,
      artworkId: item.files[0]?.id ?? null,
    }));

    return { success: true, data: itemsWithArtwork };
  } catch (error) {
    console.error("[SFTP] Get items by connection error:", error);
    return { success: false, error: "Failed to load items" };
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
    console.error("[SFTP] Get connection error:", error);
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

    revalidatePath("/dashboard/connections");
    return { success: true, data: { id: connection.id } };
  } catch (error) {
    console.error("[SFTP] Create connection error:", error);
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

    revalidatePath("/dashboard/connections");
    return { success: true };
  } catch (error) {
    console.error("[SFTP] Update connection error:", error);
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

    revalidatePath("/dashboard/connections");
    return { success: true };
  } catch (error) {
    console.error("[SFTP] Delete connection error:", error);
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

    revalidatePath("/dashboard/connections");
    return { success: true, data: { latencyMs } };
  } catch (error) {
    console.error("[SFTP] Test connection error:", error);

    // Update error state
    try {
      await prisma.sftpConnection.update({
        where: { id: connectionId },
        data: {
          lastError:
            error instanceof Error ? error.message : "Connection failed",
        },
      });
      revalidatePath("/dashboard/connections");
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
 * Creates a folder on the SFTP server and in the database.
 *
 * @param connectionId - Connection ID
 * @param parentItemId - Parent item ID (null for root)
 * @param name - Folder name
 */
export async function createSftpFolder(
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
        return { success: false, error: "Parent folder not found" };
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

    revalidatePath("/dashboard");
    return {
      success: true,
      data: {
        id: item.id,
        name: item.name,
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
    console.error("[SFTP] Create folder error:", error);
    return { success: false, error: "Failed to create folder" };
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

    // Delete folder from SFTP if connected
    if (item.connection && item.sftpPath) {
      try {
        await removeDirectory(item.connection, item.sftpPath);
      } catch (sftpError) {
        console.error("[SFTP] Delete from server failed:", sftpError);
        // Continue to delete from DB even if SFTP delete fails
      }
    }

    // Delete from database (children and files cascade deleted)
    await prisma.item.delete({
      where: { id: itemId },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[SFTP] Delete item error:", error);
    return { success: false, error: "Failed to delete item" };
  }
}

/**
 * Renames an item on SFTP server and in database.
 *
 * @param itemId - Item ID to rename
 * @param newName - New name
 */
export async function renameSftpItem(
  itemId: string,
  newName: string
): Promise<ActionResult> {
  try {
    const userId = await requireAuth();

    // Validate filename
    validateFileName(newName);

    // Get item with connection
    const item = await prisma.item.findFirst({
      where: { id: itemId, userId },
      include: { connection: true, parent: true },
    });
    if (!item) {
      return { success: false, error: "Item not found" };
    }

    // Rename on SFTP if connected
    if (item.connection && item.sftpPath) {
      const parentPath = item.parent?.sftpPath ?? item.connection.basePath;
      const newPath = sanitizePath(parentPath, newName);

      await sftpRename(item.connection, item.sftpPath, newPath);

      // Update path in database
      await prisma.item.update({
        where: { id: itemId },
        data: { name: newName, sftpPath: newPath },
      });
    } else {
      // Just update name in database
      await prisma.item.update({
        where: { id: itemId },
        data: { name: newName },
      });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("[SFTP] Rename item error:", error);
    return { success: false, error: "Failed to rename item" };
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
 * @returns Sync statistics
 */
export async function syncFromSftp(
  connectionId: string
): Promise<ActionResult<SyncResult>> {
  try {
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
        console.warn(`[SFTP] Failed to list directory: ${dirPath}`, listError);
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
      console.warn(
        `[SFTP] Sync completed with ${failedDirs.length} inaccessible directories`
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

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/connections");

    return {
      success: true,
      data: { created, updated, deleted },
    };
  } catch (error) {
    console.error("[SFTP] Sync error:", error);

    // Update error state
    try {
      await prisma.sftpConnection.update({
        where: { id: connectionId },
        data: {
          lastError: error instanceof Error ? error.message : "Sync failed",
        },
      });
      revalidatePath("/dashboard/connections");
    } catch {
      // Ignore update error
    }

    return { success: false, error: "Failed to sync from SFTP" };
  }
}
