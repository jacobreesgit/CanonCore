/**
 * Server actions for Google Drive connection and folder operations.
 * Handles OAuth, connection management, and folder CRUD operations.
 *
 * For sync operations, see: google-drive-sync.ts
 * For upload operations, see: google-drive-upload.ts
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getDriveClient,
  getAuthorizationUrl,
  generateOAuthState,
  withRateLimit,
  createFolder,
  deleteFile,
  renameFile,
  moveFile,
} from "@/lib/google-drive-client";
import { SyncStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { logSyncOperation } from "@/lib/sync-log";
import { startSyncTimer, SyncLogAction, SyncLogStatus } from "@/lib/sync-utils";
import { handlePrismaError } from "@/lib/errors";

/** Result type for Google Drive actions. */
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Initiates OAuth flow by returning the authorization URL.
 *
 * @returns Object with success status and authorization URL or error
 */
export async function initiateGoogleDriveOAuth(): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const state = generateOAuthState(session.user.id);
  const url = getAuthorizationUrl(state);

  return { success: true, url };
}

/**
 * Disconnects the user's Google Drive connection.
 *
 * @returns Object with success status or error
 */
export async function disconnectGoogleDrive(): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const connection = await prisma.googleDriveConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    return { success: false, error: "No connection to disconnect" };
  }

  try {
    // Try to trash the CanonCore folder in Drive
    const drive = await getDriveClient(connection);
    await withRateLimit(() =>
      drive.files.update({
        fileId: connection.rootFolderId,
        requestBody: { trashed: true },
      })
    ).catch((err) => {
      logger.warn({ err }, "[GoogleDrive] Failed to trash Drive folder");
      // Continue with deletion even if trashing fails
    });
  } catch (err) {
    // Token might be invalid, proceed with local deletion
    logger.warn(
      { err },
      "[GoogleDrive] Could not trash folder, proceeding with disconnect"
    );
  }

  // Delete connection (cascades to items via onDelete: SetNull)
  await prisma.googleDriveConnection.delete({
    where: { userId: session.user.id },
  });

  revalidatePath("/my-items");

  return { success: true };
}

/**
 * Gets the user's single Google Drive connection.
 *
 * @returns The connection or null if not found/unauthorized
 */
export async function getGoogleDriveConnection() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  return prisma.googleDriveConnection.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      rootFolderId: true,
      isActive: true,
      needsReauth: true,
      lastSyncAt: true,
      lastError: true,
      quotaBytesUsed: true,
      quotaBytesTotal: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Creates a folder in Google Drive WITHOUT creating an Item record.
 * Used by createItem (item-actions.ts) which already creates its own Item.
 *
 * @param parentItemId - Parent item ID (null for root level)
 * @param name - Folder name
 * @returns Result with Drive file ID only
 */
export async function createDriveFolderOnly(
  parentItemId: string | null,
  name: string
): Promise<ActionResult<{ driveFileId: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const connection = await prisma.googleDriveConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return { success: false, error: "No Google Drive connected" };
    }

    // Get parent folder's Drive ID
    let parentDriveId = connection.rootFolderId;

    if (parentItemId) {
      const parentItem = await prisma.item.findFirst({
        where: { id: parentItemId, userId: session.user.id },
        select: { driveFileId: true },
      });

      if (!parentItem?.driveFileId) {
        return { success: false, error: "Parent folder not found in Drive" };
      }

      parentDriveId = parentItem.driveFileId;
    }

    if (!parentDriveId) {
      return { success: false, error: "No root folder configured" };
    }

    const drive = await getDriveClient(connection);

    // Create folder in Drive (no Item creation)
    const driveFileId = await createFolder(drive, name, parentDriveId);

    return { success: true, data: { driveFileId } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create folder";
    logger.error({ err: error }, "[GoogleDrive] Create folder only error");
    return { success: false, error: message };
  }
}

/**
 * Creates a new folder in Google Drive and corresponding Item.
 * Used for creating items directly from Drive sync operations.
 *
 * @param parentItemId - Parent item ID (null for root level)
 * @param name - Folder name
 * @returns Result with created item ID and Drive file ID
 */
export async function createFolderInGoogleDrive(
  parentItemId: string | null,
  name: string
): Promise<ActionResult<{ itemId: string; driveFileId: string }>> {
  const timer = startSyncTimer();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const connection = await prisma.googleDriveConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return { success: false, error: "No Google Drive connected" };
    }

    // Get parent folder's Drive ID
    let parentDriveId = connection.rootFolderId;
    let depth = 0;

    if (parentItemId) {
      const parentItem = await prisma.item.findFirst({
        where: { id: parentItemId, userId: session.user.id },
        select: { driveFileId: true, depth: true },
      });

      if (!parentItem?.driveFileId) {
        return { success: false, error: "Parent folder not found in Drive" };
      }

      parentDriveId = parentItem.driveFileId;
      depth = (parentItem.depth ?? 0) + 1;
    }

    if (!parentDriveId) {
      return { success: false, error: "No root folder configured" };
    }

    const drive = await getDriveClient(connection);

    // Create folder in Drive
    const driveFileId = await createFolder(drive, name, parentDriveId);

    // Get next order
    const maxOrder = await prisma.item.aggregate({
      where: { userId: session.user.id, parentId: parentItemId },
      _max: { order: true },
    });

    // Create Item record
    const item = await prisma.item.create({
      data: {
        userId: session.user.id,
        name,
        parentId: parentItemId,
        driveConnectionId: connection.id,
        driveFileId,
        syncStatus: SyncStatus.SYNCED,
        depth,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    // Log successful create
    await logSyncOperation({
      userId: session.user.id,
      action: SyncLogAction.CREATE,
      itemId: item.id,
      itemName: name,
      status: SyncLogStatus.SUCCESS,
      duration: timer(),
    });

    revalidatePath("/my-items");
    return { success: true, data: { itemId: item.id, driveFileId } };
  } catch (error) {
    // Check for user account deleted error first
    const prismaError = handlePrismaError(error);
    if (prismaError) {
      return { success: false, error: prismaError.error };
    }

    const message =
      error instanceof Error ? error.message : "Failed to create folder";
    logger.error({ err: error }, "[GoogleDrive] Create folder error");

    // Log failed create (get user ID from auth if available)
    const session = await auth();
    if (session?.user?.id) {
      await logSyncOperation({
        userId: session.user.id,
        action: SyncLogAction.CREATE,
        itemName: name,
        status: SyncLogStatus.FAILED,
        error: message,
        duration: timer(),
      });
    }

    return { success: false, error: message };
  }
}

/**
 * Deletes an item (folder) from Google Drive.
 * Moves to trash by default for recoverability.
 *
 * @param itemId - Item ID to delete
 * @returns Success/failure result
 */
export async function deleteItemFromGoogleDrive(
  itemId: string
): Promise<ActionResult> {
  const timer = startSyncTimer();
  let itemName: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, userId: session.user.id },
      select: { name: true, driveFileId: true, driveConnectionId: true },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    itemName = item.name;

    if (!item.driveFileId || !item.driveConnectionId) {
      // Local-only item, nothing to delete from Drive
      return { success: true };
    }

    const connection = await prisma.googleDriveConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return { success: false, error: "No Google Drive connected" };
    }

    const drive = await getDriveClient(connection);

    // Delete from Drive (moves to trash)
    await deleteFile(drive, item.driveFileId);

    // Log successful delete
    await logSyncOperation({
      userId: session.user.id,
      action: SyncLogAction.DELETE,
      itemId,
      itemName: item.name,
      status: SyncLogStatus.SUCCESS,
      duration: timer(),
    });

    // Note: DB deletion is handled by item-actions.ts
    // This function only handles the Drive side

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    logger.error({ err: error }, "[GoogleDrive] Delete item error");

    // Log failed delete
    const session = await auth();
    if (session?.user?.id) {
      await logSyncOperation({
        userId: session.user.id,
        action: SyncLogAction.DELETE,
        itemId,
        itemName,
        status: SyncLogStatus.FAILED,
        error: message,
        duration: timer(),
      });
    }

    return { success: false, error: message };
  }
}

/**
 * Deletes a file from Google Drive.
 * Called after deleting from database to clean up Drive storage.
 * Silently succeeds if user has no Drive connection.
 *
 * @param driveFileId - The Google Drive file ID to delete
 */
export async function deleteFileFromDrive(driveFileId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const connection = await prisma.googleDriveConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    logger.warn({ driveFileId }, "[deleteFileFromDrive] No Drive connection");
    return;
  }

  try {
    const drive = await getDriveClient(connection);
    await withRateLimit(() => drive.files.delete({ fileId: driveFileId }));
    logger.info(
      { driveFileId },
      "[deleteFileFromDrive] File deleted from Drive"
    );
  } catch (err) {
    // Log but don't throw - file is already deleted from DB
    logger.error(
      { err, driveFileId },
      "[deleteFileFromDrive] Drive delete failed"
    );
  }
}

/**
 * Renames an item in Google Drive.
 *
 * @param itemId - Item ID to rename
 * @param newName - New name
 * @returns Success/failure result
 */
export async function renameItemInGoogleDrive(
  itemId: string,
  newName: string
): Promise<ActionResult> {
  const timer = startSyncTimer();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, userId: session.user.id },
      select: { driveFileId: true },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    // If not linked to Drive, nothing to rename there
    if (!item.driveFileId) {
      return { success: true };
    }

    const connection = await prisma.googleDriveConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return { success: false, error: "No Google Drive connected" };
    }

    const drive = await getDriveClient(connection);
    await renameFile(drive, item.driveFileId, newName);

    // Log successful rename
    await logSyncOperation({
      userId: session.user.id,
      action: SyncLogAction.RENAME,
      itemId,
      itemName: newName,
      status: SyncLogStatus.SUCCESS,
      duration: timer(),
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rename failed";
    logger.error({ err: error }, "[GoogleDrive] Rename error");

    // Log failed rename
    const session = await auth();
    if (session?.user?.id) {
      await logSyncOperation({
        userId: session.user.id,
        action: SyncLogAction.RENAME,
        itemId,
        itemName: newName,
        status: SyncLogStatus.FAILED,
        error: message,
        duration: timer(),
      });
    }

    return { success: false, error: message };
  }
}

/**
 * Moves an item to a different parent in Google Drive.
 *
 * @param itemId - Item ID to move
 * @param newParentId - New parent item ID (null for root)
 * @param oldParentId - Old parent item ID (null for root) - required because DB is already updated
 * @returns Success/failure result
 */
export async function moveItemInGoogleDrive(
  itemId: string,
  newParentId: string | null,
  oldParentId: string | null
): Promise<ActionResult> {
  const timer = startSyncTimer();
  let itemName: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, userId: session.user.id },
      select: { name: true, driveFileId: true },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    itemName = item.name;

    // If not linked to Drive, nothing to move there
    if (!item.driveFileId) {
      return { success: true };
    }

    const connection = await prisma.googleDriveConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return { success: false, error: "No Google Drive connected" };
    }

    // Get new and old parent's Drive IDs in parallel (async-parallel pattern)
    const [newParent, oldParent] = await Promise.all([
      newParentId
        ? prisma.item.findFirst({
            where: { id: newParentId, userId: session.user.id },
            select: { driveFileId: true },
          })
        : Promise.resolve(null),
      oldParentId
        ? prisma.item.findFirst({
            where: { id: oldParentId, userId: session.user.id },
            select: { driveFileId: true },
          })
        : Promise.resolve(null),
    ]);

    // Resolve Drive IDs with fallback to root folder
    let newParentDriveId: string | null = connection.rootFolderId;
    if (newParentId) {
      if (!newParent?.driveFileId) {
        return { success: false, error: "New parent not found in Drive" };
      }
      newParentDriveId = newParent.driveFileId;
    }

    let oldParentDriveId: string | null = connection.rootFolderId;
    if (oldParentId && oldParent?.driveFileId) {
      oldParentDriveId = oldParent.driveFileId;
    }

    if (oldParentDriveId && newParentDriveId) {
      const drive = await getDriveClient(connection);
      await moveFile(
        drive,
        item.driveFileId,
        newParentDriveId,
        oldParentDriveId
      );
    }

    // Log successful move
    await logSyncOperation({
      userId: session.user.id,
      action: SyncLogAction.MOVE,
      itemId,
      itemName: item.name,
      status: SyncLogStatus.SUCCESS,
      duration: timer(),
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    logger.error({ err: error }, "[GoogleDrive] Move error");

    // Log failed move
    const session = await auth();
    if (session?.user?.id) {
      await logSyncOperation({
        userId: session.user.id,
        action: SyncLogAction.MOVE,
        itemId,
        itemName,
        status: SyncLogStatus.FAILED,
        error: message,
        duration: timer(),
      });
    }

    return { success: false, error: message };
  }
}
