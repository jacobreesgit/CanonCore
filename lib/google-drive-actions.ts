/**
 * Server actions for Google Drive operations.
 * Handles connection management, sync with batched DB operations,
 * and per-file error handling for resilience.
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
  createResumableUploadUrl,
} from "@/lib/google-drive-client";
import { decryptCredential } from "@/lib/crypto";
import crypto from "crypto";
import { FileType, SyncStatus } from "@prisma/client";
import { logger } from "@/lib/logger";

import { drive_v3 } from "googleapis";

/** Result type for Google Drive actions. */
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Context object passed through sync operations.
 * Avoids module-level mutable state issues in serverless.
 */
interface SyncContext {
  connectionId: string;
  userId: string;
  rootFolderId: string;
  stats: {
    created: number;
    updated: number;
    errors: number;
  };
  errors: Array<{ fileName: string; error: string }>;
}

/**
 * Creates a fresh sync context for a sync operation.
 *
 * @param connectionId - The Google Drive connection ID
 * @param userId - The user ID
 * @param rootFolderId - The root folder ID in Google Drive
 * @returns Fresh sync context
 */
function createSyncContext(
  connectionId: string,
  userId: string,
  rootFolderId: string
): SyncContext {
  return {
    connectionId,
    userId,
    rootFolderId,
    stats: { created: 0, updated: 0, errors: 0 },
    errors: [],
  };
}

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
  } catch {
    // Token might be invalid, proceed with local deletion
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
      isActive: true,
      needsReauth: true,
      lastSyncAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Syncs items from the user's Google Drive connection.
 *
 * @returns Object with success status, sync stats, and any errors
 */
export async function syncFromGoogleDrive(): Promise<{
  success: boolean;
  itemsCreated?: number;
  itemsUpdated?: number;
  itemsErrored?: number;
  errors?: Array<{ fileName: string; error: string }>;
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
    return { success: false, error: "No Google Drive connected" };
  }

  if (connection.needsReauth) {
    return { success: false, error: "Please reconnect your Google Drive" };
  }

  logger.info(
    {
      connectionId: connection.id,
      rootFolderId: connection.rootFolderId,
      hasChangePageToken: !!connection.changePageToken,
      email: connection.email,
    },
    "[GoogleDrive] Starting sync"
  );

  const ctx = createSyncContext(
    connection.id,
    connection.userId,
    connection.rootFolderId
  );

  try {
    const drive = await getDriveClient(connection);

    if (connection.changePageToken) {
      await incrementalSync(drive, connection, ctx);

      // If incremental sync found nothing, do a full sync to catch any missed items
      // This handles edge cases where the Changes API doesn't detect new folders
      if (ctx.stats.created === 0 && ctx.stats.updated === 0) {
        logger.info(
          {
            connectionId: connection.id,
            rootFolderId: connection.rootFolderId,
          },
          "[GoogleDrive] No changes detected, performing verification sync from root"
        );
        await syncFolder(drive, ctx, connection.rootFolderId, null, 0);
        logger.info(
          { stats: ctx.stats },
          "[GoogleDrive] Verification sync complete"
        );
      }
    } else {
      await initialSync(drive, connection, ctx);
    }

    // Update last sync time
    await prisma.googleDriveConnection.update({
      where: { userId: session.user.id },
      data: {
        lastSyncAt: new Date(),
        lastError:
          ctx.errors.length > 0 ? `${ctx.errors.length} files failed` : null,
      },
    });

    revalidatePath("/my-items");

    return {
      success: true,
      itemsCreated: ctx.stats.created,
      itemsUpdated: ctx.stats.updated,
      itemsErrored: ctx.stats.errors,
      errors: ctx.errors.length > 0 ? ctx.errors.slice(0, 10) : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    logger.error({ err: error }, "[GoogleDrive] Sync error");

    await prisma.googleDriveConnection.update({
      where: { userId: session.user.id },
      data: { lastError: message },
    });

    return { success: false, error: message };
  }
}

/**
 * Performs initial full sync from Google Drive.
 *
 * @param drive - Google Drive API client
 * @param connection - The connection details
 * @param ctx - Sync context for tracking progress
 */
async function initialSync(
  drive: drive_v3.Drive,
  connection: {
    id: string;
    userId: string;
    rootFolderId: string;
  },
  ctx: SyncContext
): Promise<void> {
  // Get start page token BEFORE syncing
  const tokenResponse = await drive.changes.getStartPageToken();
  const startPageToken = tokenResponse.data.startPageToken;

  if (!startPageToken) {
    throw new Error("Failed to get start page token from Google Drive");
  }

  // Recursively sync all folders
  await syncFolder(drive, ctx, connection.rootFolderId, null, 0);

  // Save page token for incremental syncs
  await prisma.googleDriveConnection.update({
    where: { id: connection.id },
    data: { changePageToken: startPageToken },
  });
}

/**
 * Syncs a folder and its contents from Google Drive.
 *
 * @param drive - Google Drive API client
 * @param ctx - Sync context
 * @param folderId - The Drive folder ID to sync
 * @param parentItemId - The parent item ID in our database
 * @param depth - Current nesting depth
 */
async function syncFolder(
  drive: drive_v3.Drive,
  ctx: SyncContext,
  folderId: string,
  parentItemId: string | null,
  depth: number
): Promise<void> {
  if (depth > 10) return;

  // Get current max order ONCE before pagination loop
  const maxOrder = await prisma.item.aggregate({
    where: { userId: ctx.userId, parentId: parentItemId },
    _max: { order: true },
  });
  let nextOrder = (maxOrder._max.order ?? -1) + 1;

  let pageToken: string | undefined;

  do {
    logger.info(
      { folderId, parentItemId, depth },
      "[GoogleDrive] syncFolder: listing files in folder"
    );

    const response = await withRateLimit(() =>
      drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        pageSize: 1000,
        pageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields:
          "nextPageToken, files(id, name, mimeType, modifiedTime, size, thumbnailLink, parents)",
      })
    );

    // Process files in batches for better performance
    const files = response.data.files || [];

    logger.info(
      {
        folderId,
        fileCount: files.length,
        fileNames: files.map((f) => f.name),
      },
      "[GoogleDrive] syncFolder: files returned from Drive API"
    );
    const batchSize = 50;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await processBatch(drive, ctx, batch, parentItemId, depth, nextOrder + i);
    }

    nextOrder += files.length;
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);
}

/**
 * Processes a batch of files for sync.
 *
 * @param drive - Google Drive API client
 * @param ctx - Sync context
 * @param files - Batch of files to process
 * @param parentItemId - Parent item ID
 * @param depth - Current depth
 * @param startOrder - Starting order number
 */
async function processBatch(
  drive: drive_v3.Drive,
  ctx: SyncContext,
  files: drive_v3.Schema$File[],
  parentItemId: string | null,
  depth: number,
  startOrder: number
): Promise<void> {
  // Get all file IDs in this batch
  const fileIds = files.map((f) => f.id).filter(Boolean) as string[];

  logger.info(
    { batchSize: files.length, fileIds },
    "[GoogleDrive] processBatch: looking up existing items"
  );

  // Batch lookup existing items
  const existingItems = await prisma.item.findMany({
    where: {
      driveConnectionId: ctx.connectionId,
      driveFileId: { in: fileIds },
    },
  });

  const existingMap = new Map(existingItems.map((i) => [i.driveFileId, i]));

  logger.info(
    {
      existingCount: existingItems.length,
      existingIds: existingItems.map((i) => i.driveFileId),
      newFileCount: files.length - existingItems.length,
    },
    "[GoogleDrive] processBatch: existing items found"
  );

  // Process each file with error handling
  let orderOffset = 0;
  for (const file of files) {
    try {
      await processFile(
        drive,
        ctx,
        file,
        existingMap.get(file.id!),
        parentItemId,
        depth,
        startOrder + orderOffset
      );
      orderOffset++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { err: error, fileName: file.name },
        "[GoogleDrive] Failed to sync file"
      );
      ctx.stats.errors++;
      ctx.errors.push({ fileName: file.name || "Unknown", error: message });
      // Continue with next file instead of failing entire sync
    }
  }
}

/**
 * Checks if an item's values differ from Drive values.
 *
 * @param current - Current item values from database
 * @param file - Drive file with new values
 * @param parentItemId - Expected parent ID
 * @returns True if any values differ and need updating
 */
function hasItemChanges(
  current: {
    name: string;
    driveModifiedAt: Date | null;
    driveThumbnailUrl: string | null;
    parentId: string | null;
  },
  file: drive_v3.Schema$File,
  parentItemId: string | null
): boolean {
  const newName = file.name || "Untitled";
  const newModifiedAt = file.modifiedTime ? new Date(file.modifiedTime) : null;

  // Compare name
  if (current.name !== newName) return true;

  // Compare parent
  if (current.parentId !== parentItemId) return true;

  // Compare thumbnail URL
  if (current.driveThumbnailUrl !== (file.thumbnailLink || null)) return true;

  // Compare modifiedAt (with null handling)
  if (newModifiedAt) {
    if (!current.driveModifiedAt) return true;
    if (current.driveModifiedAt.getTime() !== newModifiedAt.getTime())
      return true;
  } else if (current.driveModifiedAt) {
    return true;
  }

  return false;
}

/**
 * Processes a single file or folder from Google Drive.
 * Only counts as 'updated' when values actually differ from current state.
 *
 * @param drive - Google Drive API client
 * @param ctx - Sync context
 * @param file - The Drive file/folder
 * @param existing - Existing item if updating
 * @param parentItemId - Parent item ID
 * @param depth - Current depth
 * @param order - Order position
 */
async function processFile(
  drive: drive_v3.Drive,
  ctx: SyncContext,
  file: drive_v3.Schema$File,
  existing: { id: string; depth: number } | undefined,
  parentItemId: string | null,
  depth: number,
  order: number
): Promise<void> {
  const isFolder = file.mimeType === "application/vnd.google-apps.folder";

  if (isFolder) {
    // Folders become Items
    if (existing) {
      // Fetch current values to check if update is needed
      const currentItem = await prisma.item.findUnique({
        where: { id: existing.id },
        select: {
          name: true,
          driveModifiedAt: true,
          driveThumbnailUrl: true,
          parentId: true,
        },
      });

      if (currentItem && hasItemChanges(currentItem, file, parentItemId)) {
        // Values differ - update and count
        await prisma.item.update({
          where: { id: existing.id },
          data: {
            name: file.name || "Untitled",
            driveModifiedAt: file.modifiedTime
              ? new Date(file.modifiedTime)
              : undefined,
            driveThumbnailUrl: file.thumbnailLink,
            parentId: parentItemId,
            depth,
            syncStatus: SyncStatus.SYNCED,
            syncError: null,
          },
        });
        ctx.stats.updated++;
      } else {
        // No changes - just mark as synced without counting
        await prisma.item.update({
          where: { id: existing.id },
          data: {
            syncStatus: SyncStatus.SYNCED,
            syncError: null,
          },
        });
      }
      await syncFolder(drive, ctx, file.id!, existing.id, depth + 1);
    } else {
      // Create new folder Item
      logger.info(
        { fileName: file.name, driveFileId: file.id, parentItemId, depth },
        "[GoogleDrive] processFile: creating NEW folder item"
      );

      const item = await prisma.item.create({
        data: {
          driveConnectionId: ctx.connectionId,
          userId: ctx.userId,
          driveFileId: file.id!,
          name: file.name || "Untitled",
          driveModifiedAt: file.modifiedTime
            ? new Date(file.modifiedTime)
            : new Date(),
          driveThumbnailUrl: file.thumbnailLink,
          parentId: parentItemId,
          depth,
          order,
          syncStatus: SyncStatus.SYNCED,
        },
      });
      ctx.stats.created++;
      await syncFolder(drive, ctx, file.id!, item.id, depth + 1);
    }
  } else {
    // Files handling - attach as ItemFile to parent folder
    if (existing) {
      // Existing Item for this file - check if values changed (backward compat)
      const currentItem = await prisma.item.findUnique({
        where: { id: existing.id },
        select: {
          name: true,
          driveModifiedAt: true,
          driveThumbnailUrl: true,
          parentId: true,
        },
      });

      if (currentItem && hasItemChanges(currentItem, file, parentItemId)) {
        // Values differ - update and count
        await prisma.item.update({
          where: { id: existing.id },
          data: {
            name: file.name || "Untitled",
            driveModifiedAt: file.modifiedTime
              ? new Date(file.modifiedTime)
              : undefined,
            driveThumbnailUrl: file.thumbnailLink,
            parentId: parentItemId,
            depth,
            syncStatus: SyncStatus.SYNCED,
            syncError: null,
          },
        });
        ctx.stats.updated++;
      } else {
        // No changes - just mark as synced without counting
        await prisma.item.update({
          where: { id: existing.id },
          data: {
            syncStatus: SyncStatus.SYNCED,
            syncError: null,
          },
        });
      }
      await syncItemFile(existing.id, file);
    } else if (parentItemId) {
      // File with parent folder - create or update ItemFile on parent
      logger.info(
        { fileName: file.name, driveFileId: file.id, parentItemId },
        "[GoogleDrive] processFile: attaching file as ItemFile to parent"
      );
      const syncResult = await syncItemFile(parentItemId, file);
      if (syncResult.wasCreated) {
        ctx.stats.created++;
      } else if (syncResult.hadChanges) {
        ctx.stats.updated++;
      }
      // If no changes, don't count anything
    } else {
      // NEW file at root level (no parent) - create Item + ItemFile
      logger.info(
        { fileName: file.name, driveFileId: file.id },
        "[GoogleDrive] processFile: creating root-level file as Item"
      );

      const item = await prisma.item.create({
        data: {
          driveConnectionId: ctx.connectionId,
          userId: ctx.userId,
          driveFileId: file.id!,
          name: file.name || "Untitled",
          driveModifiedAt: file.modifiedTime
            ? new Date(file.modifiedTime)
            : new Date(),
          driveThumbnailUrl: file.thumbnailLink,
          parentId: null,
          depth: 0,
          order,
          syncStatus: SyncStatus.SYNCED,
        },
      });
      ctx.stats.created++;
      await syncItemFile(item.id, file);
    }
  }
}

/** Result of syncing an ItemFile. */
interface SyncItemFileResult {
  wasCreated: boolean;
  hadChanges: boolean;
}

/**
 * Syncs or creates an ItemFile record for a Drive file.
 * Only reports hadChanges when values actually differ.
 *
 * @param itemId - The item ID
 * @param file - The Drive file
 * @returns Object indicating if file was created and if it had changes
 */
async function syncItemFile(
  itemId: string,
  file: drive_v3.Schema$File
): Promise<SyncItemFileResult> {
  const fileType = categorizeFileType(file.mimeType || "", file.name || "");
  const newFilename = file.name || "unknown";
  const newMimeType = file.mimeType || "application/octet-stream";
  const newSize = file.size ? BigInt(file.size) : null;

  // Check if file already exists and compare values
  const existing = await prisma.itemFile.findFirst({
    where: { itemId, driveFileId: file.id! },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
    },
  });

  if (!existing) {
    // Create new file
    await prisma.itemFile.create({
      data: {
        itemId,
        driveFileId: file.id!,
        filename: newFilename,
        fileType,
        mimeType: newMimeType,
        size: newSize,
        syncStatus: SyncStatus.SYNCED,
      },
    });
    return { wasCreated: true, hadChanges: false };
  }

  // Check if values actually changed
  const hadChanges =
    existing.filename !== newFilename ||
    existing.mimeType !== newMimeType ||
    existing.size !== newSize;

  if (hadChanges) {
    await prisma.itemFile.update({
      where: { id: existing.id },
      data: {
        filename: newFilename,
        mimeType: newMimeType,
        size: newSize,
        syncStatus: SyncStatus.SYNCED,
        syncError: null,
      },
    });
  } else {
    // Just mark as synced without updating other fields
    await prisma.itemFile.update({
      where: { id: existing.id },
      data: {
        syncStatus: SyncStatus.SYNCED,
        syncError: null,
      },
    });
  }

  return { wasCreated: false, hadChanges };
}

/**
 * Categorizes a file type based on MIME type and filename.
 *
 * @param mimeType - The MIME type
 * @param filename - The filename
 * @returns The categorized file type
 */
function categorizeFileType(mimeType: string, filename: string): FileType {
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
    return FileType.MEDIA;
  }
  if (mimeType.startsWith("image/")) {
    return FileType.ARTWORK;
  }
  const ext = filename.split(".").pop()?.toLowerCase();
  if (["srt", "vtt", "sub", "ass"].includes(ext || "")) {
    return FileType.SUBTITLE;
  }
  return FileType.MEDIA;
}

/**
 * Performs incremental sync using change tokens.
 *
 * @param drive - Google Drive API client
 * @param connection - The connection with change token
 * @param ctx - Sync context
 */
async function incrementalSync(
  drive: drive_v3.Drive,
  connection: {
    id: string;
    userId: string;
    rootFolderId: string;
    changePageToken: string | null;
  },
  ctx: SyncContext
): Promise<void> {
  if (!connection.changePageToken) {
    return initialSync(drive, connection, ctx);
  }

  let pageToken: string | null = connection.changePageToken;
  let newStartPageToken: string | undefined;

  try {
    do {
      const response = await withRateLimit(() =>
        drive.changes.list({
          pageToken: pageToken!,
          pageSize: 1000,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          fields:
            "newStartPageToken, nextPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, size, thumbnailLink, parents, trashed))",
        })
      );

      const changes = response.data.changes || [];
      logger.info(
        { changeCount: changes.length, pageToken },
        "[GoogleDrive] Processing incremental changes"
      );

      for (const change of changes) {
        try {
          if (change.removed || change.file?.trashed) {
            await handleFileRemoved(ctx.connectionId, change.fileId);
          } else if (change.file) {
            await handleFileChanged(drive, ctx, change.file);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          logger.error(
            { err: error, fileId: change.fileId },
            "[GoogleDrive] Failed to process change"
          );
          ctx.stats.errors++;
          ctx.errors.push({
            fileName: change.file?.name || change.fileId || "Unknown",
            error: message,
          });
        }
      }

      if (response.data.newStartPageToken) {
        newStartPageToken = response.data.newStartPageToken;
      }

      pageToken = response.data.nextPageToken ?? null;
    } while (pageToken);

    // Update page token
    if (newStartPageToken) {
      await prisma.googleDriveConnection.update({
        where: { id: connection.id },
        data: { changePageToken: newStartPageToken },
      });
    }
  } catch (error: unknown) {
    const isExpiredToken =
      error instanceof Error &&
      ((error as { code?: number }).code === 404 ||
        error.message?.includes("pageToken"));

    if (isExpiredToken) {
      logger.warn(
        { connectionId: connection.id },
        "[GoogleDrive] Change page token expired, performing full sync"
      );
      // Clear token and do full sync
      await prisma.googleDriveConnection.update({
        where: { id: connection.id },
        data: { changePageToken: null },
      });
      return initialSync(drive, connection, ctx);
    }

    throw error;
  }
}

/**
 * Handles a removed or trashed file from Google Drive.
 * Checks both Item (folders) and ItemFile (files) records.
 *
 * @param connectionId - The connection ID
 * @param fileId - The Drive file ID
 */
async function handleFileRemoved(
  connectionId: string,
  fileId: string | null | undefined
): Promise<void> {
  if (!fileId) return;

  // Check if it's a folder (Item)
  const item = await prisma.item.findFirst({
    where: { driveConnectionId: connectionId, driveFileId: fileId },
  });

  if (item) {
    await prisma.item.delete({ where: { id: item.id } });
    return;
  }

  // Check if it's a file (ItemFile) - must join with parent Item to verify connection
  const itemFile = await prisma.itemFile.findFirst({
    where: {
      driveFileId: fileId,
      item: { driveConnectionId: connectionId },
    },
  });

  if (itemFile) {
    await prisma.itemFile.delete({ where: { id: itemFile.id } });
  }
}

/**
 * Handles a changed file from Google Drive.
 *
 * @param drive - Google Drive API client
 * @param ctx - Sync context
 * @param file - The changed file
 */
async function handleFileChanged(
  drive: drive_v3.Drive,
  ctx: SyncContext,
  file: drive_v3.Schema$File
): Promise<void> {
  if (!file.id) return;

  // Check if file is in our tree (parent is in our items or is root folder)
  const parentDriveId = file.parents?.[0];

  if (!parentDriveId) return;

  // If parent is root folder, it's a top-level item
  const isTopLevel = parentDriveId === ctx.rootFolderId;

  // Otherwise check if parent is in our items
  let parentItem: { id: string; depth: number } | null = null;
  let depth = 0;

  if (!isTopLevel) {
    parentItem = await prisma.item.findFirst({
      where: {
        driveConnectionId: ctx.connectionId,
        driveFileId: parentDriveId,
      },
      select: { id: true, depth: true },
    });

    if (!parentItem) {
      // Parent not in our tree, skip this file
      return;
    }
    depth = (parentItem.depth ?? 0) + 1;
  }

  const existing = await prisma.item.findFirst({
    where: { driveConnectionId: ctx.connectionId, driveFileId: file.id },
    select: { id: true, depth: true },
  });

  // Get next order
  const maxOrder = await prisma.item.aggregate({
    where: { userId: ctx.userId, parentId: parentItem?.id ?? null },
    _max: { order: true },
  });
  const nextOrder = (maxOrder._max.order ?? -1) + 1;

  await processFile(
    drive,
    ctx,
    file,
    existing ?? undefined,
    parentItem?.id ?? null,
    depth,
    nextOrder
  );
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

    revalidatePath("/my-items");
    return { success: true, data: { itemId: item.id, driveFileId } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create folder";
    logger.error({ err: error }, "[GoogleDrive] Create folder error");
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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    const item = await prisma.item.findFirst({
      where: { id: itemId, userId: session.user.id },
      select: { driveFileId: true, driveConnectionId: true },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

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

    // Note: DB deletion is handled by item-actions.ts
    // This function only handles the Drive side

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    logger.error({ err: error }, "[GoogleDrive] Delete item error");
    return { success: false, error: message };
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

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rename failed";
    logger.error({ err: error }, "[GoogleDrive] Rename error");
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

    // Get new parent's Drive ID
    let newParentDriveId: string | null = connection.rootFolderId;

    if (newParentId) {
      const newParent = await prisma.item.findFirst({
        where: { id: newParentId, userId: session.user.id },
        select: { driveFileId: true },
      });

      if (!newParent?.driveFileId) {
        return { success: false, error: "New parent not found in Drive" };
      }

      newParentDriveId = newParent.driveFileId;
    }

    // Get old parent's Drive ID (passed in because DB already updated)
    let oldParentDriveId: string | null = connection.rootFolderId;

    if (oldParentId) {
      const oldParent = await prisma.item.findFirst({
        where: { id: oldParentId, userId: session.user.id },
        select: { driveFileId: true },
      });

      if (oldParent?.driveFileId) {
        oldParentDriveId = oldParent.driveFileId;
      }
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

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Move failed";
    logger.error({ err: error }, "[GoogleDrive] Move error");
    return { success: false, error: message };
  }
}

// ============================================================================
// Direct Browser Upload (Resumable Upload Protocol)
// ============================================================================

/** Upload session token payload for JWT-like signing. */
interface UploadSessionPayload {
  itemId: string;
  userId: string;
  fileName: string;
  mimeType: string;
  parentDriveId: string;
  fileType: FileType;
  exp: number; // Expiry timestamp (ms)
}

/**
 * Gets the signing key for upload session tokens.
 * Derives from AUTH_SECRET for consistency with NextAuth.
 */
function getUploadSigningKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET not configured");
  const buffer = crypto.createHash("sha256").update(secret, "utf8").digest();
  return new Uint8Array(buffer);
}

/**
 * Creates a signed upload session token.
 * Uses HMAC-SHA256 for tamper-proof tokens.
 *
 * @param payload - Session data to encode
 * @returns Base64url-encoded signed token
 */
function signUploadSessionToken(payload: UploadSessionPayload): string {
  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", getUploadSigningKey())
    .update(data, "utf8")
    .digest("hex");

  return Buffer.from(`${data}.${signature}`).toString("base64url");
}

/**
 * Verifies and decodes an upload session token.
 * Returns null if token is invalid, tampered, or expired.
 *
 * @param token - The signed token to verify
 * @returns Decoded payload or null if invalid
 */
function verifyUploadSessionToken(token: string): UploadSessionPayload | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;

    const data = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", getUploadSigningKey())
      .update(data, "utf8")
      .digest("hex");

    if (
      !crypto.timingSafeEqual(
        new Uint8Array(Buffer.from(signature)),
        new Uint8Array(Buffer.from(expectedSignature))
      )
    ) {
      return null;
    }

    const payload = JSON.parse(data) as UploadSessionPayload;

    // Check expiry
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Sanitizes a filename to prevent path traversal attacks.
 *
 * @param filename - The filename to sanitize
 * @returns Sanitized filename
 */
function sanitizeFileName(filename: string): string {
  // Remove path components and dangerous characters
  return filename.replace(/\.\./g, "").replace(/[/\\]/g, "").trim();
}

/** Input for creating upload sessions. */
interface UploadFileInput {
  name: string;
  mimeType: string;
}

/** Single upload session response. */
interface UploadSession {
  fileName: string;
  uploadUrl: string;
  sessionToken: string;
}

/**
 * Creates upload sessions for multiple files.
 * Returns resumable upload URLs from Google Drive with CORS enabled.
 *
 * IMPORTANT: Origin is required for CORS - Google Drive resumable uploads
 * only allow browser requests from the origin specified at session creation.
 *
 * @param itemId - The item to attach files to
 * @param files - Array of file metadata (name, mimeType)
 * @param origin - Client origin for CORS (e.g., "https://canoncore.com")
 * @returns Upload sessions with URLs and signed tokens
 */
export async function createUploadSessions(
  itemId: string,
  files: UploadFileInput[],
  origin: string
): Promise<{
  success: boolean;
  sessions?: UploadSession[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Validate input
    if (!files.length) {
      return { success: false, error: "No files provided" };
    }

    if (files.length > 10) {
      return { success: false, error: "Maximum 10 files per batch" };
    }

    // Get connection and item
    const [connection, item] = await Promise.all([
      prisma.googleDriveConnection.findUnique({
        where: { userId: session.user.id },
      }),
      prisma.item.findFirst({
        where: { id: itemId, userId: session.user.id },
        select: { id: true, driveFileId: true },
      }),
    ]);

    if (!connection) {
      return { success: false, error: "No Google Drive connected" };
    }

    if (connection.needsReauth) {
      return { success: false, error: "Please reconnect your Google Drive" };
    }

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    // Determine parent folder in Drive
    const parentDriveId = item.driveFileId || connection.rootFolderId;
    if (!parentDriveId) {
      return { success: false, error: "No Drive folder for this item" };
    }

    // Get access token (refresh if needed)
    let accessToken: string;
    const needsRefresh =
      !connection.accessTokenExpiry ||
      new Date(connection.accessTokenExpiry) < new Date(Date.now() + 60000);

    if (needsRefresh) {
      const { refreshAccessToken } = await import("@/lib/google-drive-client");
      accessToken = await refreshAccessToken(
        connection.id,
        connection.encryptedRefreshToken
      );
    } else {
      accessToken = decryptCredential(connection.encryptedAccessToken!);
    }

    // Create upload sessions for each file
    const sessions: UploadSession[] = [];
    const expiry = Date.now() + 60 * 60 * 1000; // 1 hour

    for (const file of files) {
      const sanitizedName = sanitizeFileName(file.name);
      if (!sanitizedName) {
        return { success: false, error: `Invalid filename: ${file.name}` };
      }

      const fileType = categorizeFileType(file.mimeType, sanitizedName);

      // Create resumable upload URL with CORS support
      const uploadUrl = await createResumableUploadUrl(
        accessToken,
        sanitizedName,
        file.mimeType,
        parentDriveId,
        origin
      );

      // Create signed session token
      const payload: UploadSessionPayload = {
        itemId,
        userId: session.user.id,
        fileName: sanitizedName,
        mimeType: file.mimeType,
        parentDriveId,
        fileType,
        exp: expiry,
      };

      const sessionToken = signUploadSessionToken(payload);

      sessions.push({
        fileName: sanitizedName,
        uploadUrl,
        sessionToken,
      });
    }

    return { success: true, sessions };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to create upload session";
    logger.error({ err: error }, "[GoogleDrive] Create upload sessions error");
    return { success: false, error: message };
  }
}

/**
 * Confirms upload completed and creates ItemFile record.
 * Validates JWT signature and creates database record.
 *
 * @param sessionToken - JWT from createUploadSessions
 * @param driveFileId - The Google Drive file ID returned after upload
 * @returns Created ItemFile info
 */
export async function confirmUpload(
  sessionToken: string,
  driveFileId: string
): Promise<{
  success: boolean;
  itemFile?: { id: string; filename: string; fileType: string };
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify and decode token
    const payload = verifyUploadSessionToken(sessionToken);
    if (!payload) {
      return { success: false, error: "Invalid or expired session token" };
    }

    // Verify user matches
    if (payload.userId !== session.user.id) {
      logger.warn(
        { tokenUserId: payload.userId, sessionUserId: session.user.id },
        "[GoogleDrive] User mismatch in upload confirmation"
      );
      return { success: false, error: "Unauthorized" };
    }

    // Check if this driveFileId was already used (prevent replay)
    const existingFile = await prisma.itemFile.findFirst({
      where: { driveFileId },
    });

    if (existingFile) {
      return { success: false, error: "File already registered" };
    }

    // Verify item still exists and belongs to user
    const item = await prisma.item.findFirst({
      where: { id: payload.itemId, userId: session.user.id },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    // Check if there's already a primary file of this type
    // If not, make this file primary (only for CanonCore uploads, not Drive sync)
    const existingPrimary = await prisma.itemFile.findFirst({
      where: {
        itemId: payload.itemId,
        fileType: payload.fileType,
        isPrimary: true,
      },
    });

    // Create ItemFile record
    const itemFile = await prisma.itemFile.create({
      data: {
        itemId: payload.itemId,
        filename: payload.fileName,
        driveFileId,
        fileType: payload.fileType,
        mimeType: payload.mimeType,
        syncStatus: SyncStatus.SYNCED,
        isPrimary: !existingPrimary, // Auto-set primary if first of this type
      },
    });

    revalidatePath("/my-items");
    revalidatePath(`/my-items/${payload.itemId}`);

    return {
      success: true,
      itemFile: {
        id: itemFile.id,
        filename: itemFile.filename,
        fileType: itemFile.fileType,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to confirm upload";
    logger.error({ err: error }, "[GoogleDrive] Confirm upload error");
    return { success: false, error: message };
  }
}
