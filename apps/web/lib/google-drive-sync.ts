/**
 * Google Drive sync operations.
 * Handles bidirectional sync between Google Drive and local database.
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getDriveClient,
  withRateLimit,
  checkRootFolderStatus,
} from "@/lib/google-drive-client";
import { SyncStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { categorizeFileType } from "@/lib/file-type-utils";
import { drive_v3 } from "googleapis";
import { logSyncOperation } from "@/lib/sync-log";
import { startSyncTimer, SyncLogAction, SyncLogStatus } from "@/lib/sync-utils";

/** Maximum nesting depth for folder sync (prevents runaway recursion). */
const MAX_SYNC_DEPTH = 10;

/** Number of files to request per Drive API page. */
const DRIVE_PAGE_SIZE = 1000;

/** Number of files to process in each database batch. */
const DB_BATCH_SIZE = 50;

/**
 * Context object passed through sync operations.
 * Avoids module-level mutable state issues in serverless.
 */
export interface SyncContext {
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

/** Result of syncing an ItemFile. */
interface SyncItemFileResult {
  wasCreated: boolean;
  hadChanges: boolean;
}

/** Options for sync operations. */
interface SyncOptions {
  /** Whether to fetch and update storage quota (default: false). */
  fetchQuota?: boolean;
  /** Whether to revalidate the /u layout after sync (default: false). */
  revalidate?: boolean;
}

/** Result type for sync operations. */
interface SyncResult {
  success: boolean;
  itemsCreated?: number;
  itemsUpdated?: number;
  itemsErrored?: number;
  errors?: Array<{ fileName: string; error: string }>;
  error?: string;
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
 * Core sync logic shared between syncFromGoogleDrive and syncByUserId.
 * Performs the actual sync operation for a given connection.
 *
 * @param connection - The Google Drive connection to sync
 * @param options - Sync options (fetchQuota, revalidate)
 * @returns Sync result with stats and any errors
 */
async function syncForConnection(
  connection: {
    id: string;
    userId: string;
    rootFolderId: string;
    changePageToken: string | null;
    lastError: string | null;
    email: string;
    encryptedRefreshToken: string;
    encryptedAccessToken: string | null;
    accessTokenExpiry: Date | null;
  },
  options: SyncOptions = {}
): Promise<SyncResult> {
  const { fetchQuota = false, revalidate = false } = options;

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

  const syncTimer = startSyncTimer();

  try {
    const drive = await getDriveClient(connection);

    // Check root folder status before syncing
    const rootStatus = await checkRootFolderStatus(
      drive,
      connection.rootFolderId
    );

    if (!rootStatus.exists) {
      await prisma.googleDriveConnection.update({
        where: { id: connection.id },
        data: { lastError: "ROOT_FOLDER_DELETED", lastSyncAt: new Date() },
      });
      logger.warn(
        { connectionId: connection.id },
        "[GoogleDrive] Root folder permanently deleted"
      );
      return { success: false, error: "ROOT_FOLDER_DELETED" };
    }

    if (rootStatus.trashed) {
      await prisma.googleDriveConnection.update({
        where: { id: connection.id },
        data: { lastError: "ROOT_FOLDER_TRASHED", lastSyncAt: new Date() },
      });
      logger.warn(
        { connectionId: connection.id },
        "[GoogleDrive] Root folder is in trash"
      );
      return { success: false, error: "ROOT_FOLDER_TRASHED" };
    }

    // Clear any previous root folder error if folder is now healthy
    if (connection.lastError?.startsWith("ROOT_FOLDER_")) {
      await prisma.googleDriveConnection.update({
        where: { id: connection.id },
        data: { lastError: null },
      });
      logger.info(
        { connectionId: connection.id },
        "[GoogleDrive] Root folder restored, clearing error"
      );
    }

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

    // Build update data for connection
    const updateData: {
      lastSyncAt: Date;
      lastError: string | null;
      quotaBytesUsed?: bigint;
      quotaBytesTotal?: bigint;
    } = {
      lastSyncAt: new Date(),
      lastError:
        ctx.errors.length > 0 ? `${ctx.errors.length} files failed` : null,
    };

    // Optionally fetch quota
    if (fetchQuota) {
      try {
        const aboutResponse = await withRateLimit(() =>
          drive.about.get({ fields: "storageQuota" })
        );
        const quota = aboutResponse.data.storageQuota;
        if (quota?.usage && quota?.limit) {
          updateData.quotaBytesUsed = BigInt(quota.usage);
          updateData.quotaBytesTotal = BigInt(quota.limit);
        }
      } catch (error) {
        // Quota fetch failure is non-fatal - log and continue
        logger.warn({ err: error }, "[GoogleDrive] Failed to fetch quota");
      }
    }

    // Update connection state
    await prisma.googleDriveConnection.update({
      where: { userId: connection.userId },
      data: updateData,
    });

    // Optionally revalidate path
    if (revalidate) {
      revalidatePath("/u", "layout");
    }

    // Log successful sync operation
    await logSyncOperation({
      userId: connection.userId,
      action: SyncLogAction.SYNC,
      status:
        ctx.stats.errors > 0 ? SyncLogStatus.FAILED : SyncLogStatus.SUCCESS,
      error:
        ctx.stats.errors > 0
          ? `${ctx.stats.errors} items failed to sync`
          : undefined,
      duration: syncTimer(),
    });

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
      where: { userId: connection.userId },
      data: { lastError: message },
    });

    // Log failed sync operation
    await logSyncOperation({
      userId: connection.userId,
      action: SyncLogAction.SYNC,
      status: SyncLogStatus.FAILED,
      error: message,
      duration: syncTimer(),
    });

    return { success: false, error: message };
  }
}

/**
 * Syncs items from the user's Google Drive connection.
 * Fetches quota and revalidates the page after sync.
 *
 * @returns Object with success status, sync stats, and any errors
 */
export async function syncFromGoogleDrive(): Promise<SyncResult> {
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

  return syncForConnection(connection, { fetchQuota: true, revalidate: true });
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
  if (depth > MAX_SYNC_DEPTH) {
    logger.warn(
      { folderId, depth, maxDepth: MAX_SYNC_DEPTH },
      "[GoogleDrive] Max sync depth exceeded, skipping folder"
    );
    return;
  }

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
        pageSize: DRIVE_PAGE_SIZE,
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
    const batchSize = DB_BATCH_SIZE;

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

  // Extract media dimensions from Drive metadata
  const newDurationMs = file.videoMediaMetadata?.durationMillis
    ? BigInt(file.videoMediaMetadata.durationMillis)
    : null;
  const newWidth =
    file.videoMediaMetadata?.width ?? file.imageMediaMetadata?.width ?? null;
  const newHeight =
    file.videoMediaMetadata?.height ?? file.imageMediaMetadata?.height ?? null;

  // Check if file already exists and compare values
  const existing = await prisma.itemFile.findFirst({
    where: { itemId, driveFileId: file.id! },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      durationMs: true,
      width: true,
      height: true,
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
        durationMs: newDurationMs,
        width: newWidth,
        height: newHeight,
        syncStatus: SyncStatus.SYNCED,
      },
    });
    return { wasCreated: true, hadChanges: false };
  }

  // Check if values actually changed
  const hadChanges =
    existing.filename !== newFilename ||
    existing.mimeType !== newMimeType ||
    existing.size !== newSize ||
    existing.durationMs !== newDurationMs ||
    existing.width !== newWidth ||
    existing.height !== newHeight;

  if (hadChanges) {
    await prisma.itemFile.update({
      where: { id: existing.id },
      data: {
        filename: newFilename,
        mimeType: newMimeType,
        size: newSize,
        durationMs: newDurationMs,
        width: newWidth,
        height: newHeight,
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
          pageSize: DRIVE_PAGE_SIZE,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          fields:
            "newStartPageToken, nextPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, size, thumbnailLink, parents, trashed, videoMediaMetadata, imageMediaMetadata))",
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
 * Syncs items from Google Drive for a specific user by ID.
 * Used by seed script and other contexts where auth session is unavailable.
 *
 * @param userId - The user ID to sync for
 * @param options - Optional sync options (fetchQuota, revalidate)
 * @returns Object with success status, sync stats, and any errors
 */
export async function syncByUserId(
  userId: string,
  options?: SyncOptions
): Promise<SyncResult> {
  const connection = await prisma.googleDriveConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    return { success: false, error: "No Google Drive connected" };
  }

  if (connection.needsReauth) {
    return { success: false, error: "Please reconnect your Google Drive" };
  }

  return syncForConnection(connection, options);
}
