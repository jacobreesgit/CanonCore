/**
 * Server actions for ItemFile operations.
 * Handles playback progress, file metadata, primary file selection, and item settings.
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeItemFile } from "@/lib/types";
import { itemNameSchema, itemDescriptionSchema } from "@/lib/validations";
import { isFileComplete } from "@/lib/progress-utils";
import { createWatchRecordIfNotRecent } from "@/lib/watch-record-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  renameItemInGoogleDrive,
  deleteFileFromDrive,
} from "@/lib/google-drive-actions";
import { logger } from "@/lib/logger";
import type { SerializedItemFile } from "@/lib/types";

/** Result type for item file actions */
type ItemFileResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

/**
 * Updates the playback position for a media file.
 *
 * @param fileId - ItemFile ID
 * @param position - Current playback position in seconds
 * @param duration - Total duration in seconds (optional)
 */
export async function updatePlaybackPosition(
  fileId: string,
  position: number,
  duration?: number | null
): Promise<ItemFileResult> {
  try {
    // Parallelize auth + file fetch
    const [session, file] = await Promise.all([
      auth(),
      prisma.itemFile.findUnique({
        where: { id: fileId },
        include: { item: true },
      }),
    ]);

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (file.item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    await prisma.itemFile.update({
      where: { id: fileId },
      data: {
        playbackPosition: position,
        ...(duration !== undefined &&
          duration !== null && { playbackDuration: duration }),
      },
    });

    // Auto-scrobble: create WatchRecord when crossing completion threshold.
    // The threshold check is in JS (cheap) so we only hit the DB for dedup
    // when the position is actually past 80%.
    const effectiveDuration = duration ?? file.playbackDuration;
    if (isFileComplete(position, effectiveDuration)) {
      await createWatchRecordIfNotRecent(file.itemId, session.user.id, "AUTO");
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to update playback position" };
  }
}

/** ItemFiles grouped by type (serialized for client) */
interface GroupedItemFiles {
  media: SerializedItemFile[];
  artwork: SerializedItemFile[];
  subtitles: SerializedItemFile[];
}

/**
 * Gets ItemFiles attached to an Item, grouped by type.
 *
 * @param itemId - Parent Item ID
 * @returns ItemFiles grouped by type (media, artwork, subtitles)
 */
export async function getItemFiles(
  itemId: string
): Promise<ItemFileResult<GroupedItemFiles>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const files = await prisma.itemFile.findMany({
      where: {
        itemId,
        item: { userId: session.user.id },
      },
      orderBy: [{ isHero: "desc" }, { isPrimary: "desc" }, { filename: "asc" }],
    });

    // Group by file type and serialize for client
    const grouped: GroupedItemFiles = {
      media: files.filter((f) => f.fileType === "MEDIA").map(serializeItemFile),
      artwork: files
        .filter((f) => f.fileType === "ARTWORK")
        .map(serializeItemFile),
      subtitles: files
        .filter((f) => f.fileType === "SUBTITLE")
        .map(serializeItemFile),
    };

    return { success: true, data: grouped };
  } catch {
    return { success: false, error: "Failed to load files" };
  }
}

/**
 * Gets a single ItemFile by ID.
 *
 * @param fileId - ItemFile ID
 * @returns The ItemFile if found and owned by user (serialized for client)
 */
export async function getItemFile(
  fileId: string
): Promise<ItemFileResult<SerializedItemFile>> {
  try {
    // Parallelize auth + file fetch
    const [session, file] = await Promise.all([
      auth(),
      prisma.itemFile.findUnique({
        where: { id: fileId },
        include: { item: true },
      }),
    ]);

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (file.item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    const { item: _item, ...fileWithoutItem } = file;
    return { success: true, data: serializeItemFile(fileWithoutItem) };
  } catch {
    return { success: false, error: "Failed to load file" };
  }
}

/**
 * Sets a file as primary for its type within an item.
 * Unsets any other primary files of the same type.
 * Uses a transaction to ensure atomicity.
 *
 * @param fileId - The ID of the file to set as primary
 * @returns Success or error result
 */
export async function setPrimaryFile(fileId: string): Promise<ItemFileResult> {
  try {
    // Parallelize auth + file fetch
    const [session, file] = await Promise.all([
      auth(),
      prisma.itemFile.findUnique({
        where: { id: fileId },
        include: { item: true },
      }),
    ]);

    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (file.item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    // Use transaction to ensure atomicity (prevents race conditions)
    await prisma.$transaction([
      // Unset existing primary files of the same type
      prisma.itemFile.updateMany({
        where: {
          itemId: file.itemId,
          fileType: file.fileType,
          isPrimary: true,
        },
        data: { isPrimary: false },
      }),
      // Set this file as primary
      prisma.itemFile.update({
        where: { id: fileId },
        data: { isPrimary: true },
      }),
    ]);

    // Revalidate the page to reflect changes
    revalidatePath("/u", "layout");

    return { success: true };
  } catch {
    return { success: false, error: "Failed to set primary file" };
  }
}

/**
 * Changes to apply atomically to item settings.
 * All fields are optional - only provided fields will be updated.
 */
interface ItemSettingsChanges {
  /** New item name */
  name?: string;
  /** New item description (empty string clears) */
  description?: string;
  /** ID of file to set as primary media */
  primaryMediaId?: string;
  /** ID of file to set as primary artwork */
  primaryArtworkId?: string;
  /** ID of file to set as hero artwork */
  heroArtworkId?: string;
  /** ID of file to set as primary subtitle */
  primarySubtitleId?: string;
}

/**
 * Updates all item settings atomically in a single transaction.
 * Validates file ownership and types before applying changes.
 * Used by the Item Settings dialog's single Save button.
 *
 * @param itemId - ID of the item to update
 * @param changes - Settings to apply (name, description, file selections)
 * @returns Success or error result
 *
 * @example
 * const result = await updateItemSettings("item-123", {
 *   name: "Breaking Bad",
 *   primaryArtworkId: "file-456",
 *   heroArtworkId: "file-789"
 * });
 */
export async function updateItemSettings(
  itemId: string,
  changes: ItemSettingsChanges
): Promise<ItemFileResult> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemUpdate"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Verify user owns the item and get connection info
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        userId: true,
        name: true,
        driveFileId: true,
        driveConnection: true,
        parent: { select: { driveFileId: true } },
      },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    if (item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    // Collect all file IDs that need validation
    const fileIds = [
      changes.primaryMediaId,
      changes.primaryArtworkId,
      changes.heroArtworkId,
      changes.primarySubtitleId,
    ].filter((id): id is string => id !== undefined);

    // Validate all files if any are specified
    if (fileIds.length > 0) {
      const files = await prisma.itemFile.findMany({
        where: { id: { in: fileIds } },
        select: { id: true, itemId: true, fileType: true },
      });

      // Verify all files exist
      if (files.length !== fileIds.length) {
        return { success: false, error: "One or more files not found" };
      }

      // Verify all files belong to this item
      if (files.some((f) => f.itemId !== itemId)) {
        return { success: false, error: "File does not belong to this item" };
      }

      // Validate file types match their intended use
      const fileMap = new Map(files.map((f) => [f.id, f.fileType]));

      if (
        changes.primaryMediaId &&
        fileMap.get(changes.primaryMediaId) !== "MEDIA"
      ) {
        return { success: false, error: "Primary media must be a MEDIA file" };
      }

      if (
        changes.primaryArtworkId &&
        fileMap.get(changes.primaryArtworkId) !== "ARTWORK"
      ) {
        return {
          success: false,
          error: "Primary artwork must be an ARTWORK file",
        };
      }

      if (
        changes.heroArtworkId &&
        fileMap.get(changes.heroArtworkId) !== "ARTWORK"
      ) {
        return { success: false, error: "Hero image must be an ARTWORK file" };
      }

      if (
        changes.primarySubtitleId &&
        fileMap.get(changes.primarySubtitleId) !== "SUBTITLE"
      ) {
        return {
          success: false,
          error: "Primary subtitle must be a SUBTITLE file",
        };
      }
    }

    // Build item update data
    const itemUpdateData: {
      name?: string;
      description?: string | null;
    } = {};

    // Handle name change - may require Google Drive rename
    if (changes.name !== undefined && changes.name !== item.name) {
      const validation = itemNameSchema.safeParse(changes.name);
      if (!validation.success) {
        return { success: false, error: validation.error.issues[0].message };
      }
      itemUpdateData.name = validation.data;

      // If item is connected to Google Drive, rename there too (async, don't block)
      if (item.driveFileId) {
        renameItemInGoogleDrive(itemId, validation.data).catch((err) => {
          logger.error({ err, itemId }, "[GoogleDrive] Rename error");
        });
      }
    }

    if (changes.description !== undefined) {
      if (changes.description === "") {
        itemUpdateData.description = null;
      } else {
        const validation = itemDescriptionSchema.safeParse(changes.description);
        if (!validation.success) {
          return { success: false, error: validation.error.issues[0].message };
        }
        itemUpdateData.description = validation.data || null;
      }
    }

    // Execute all updates in a single transaction
    await prisma.$transaction(async (tx) => {
      // Update item name/description if provided
      if (Object.keys(itemUpdateData).length > 0) {
        await tx.item.update({
          where: { id: itemId },
          data: itemUpdateData,
        });
      }

      // Update primary media
      if (changes.primaryMediaId !== undefined) {
        await tx.itemFile.updateMany({
          where: { itemId, fileType: "MEDIA", isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.itemFile.update({
          where: { id: changes.primaryMediaId },
          data: { isPrimary: true },
        });
      }

      // Update primary artwork
      if (changes.primaryArtworkId !== undefined) {
        await tx.itemFile.updateMany({
          where: { itemId, fileType: "ARTWORK", isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.itemFile.update({
          where: { id: changes.primaryArtworkId },
          data: { isPrimary: true },
        });
      }

      // Update hero artwork
      if (changes.heroArtworkId !== undefined) {
        await tx.itemFile.updateMany({
          where: { itemId, fileType: "ARTWORK", isHero: true },
          data: { isHero: false },
        });
        await tx.itemFile.update({
          where: { id: changes.heroArtworkId },
          data: { isHero: true },
        });
      }

      // Update primary subtitle
      if (changes.primarySubtitleId !== undefined) {
        await tx.itemFile.updateMany({
          where: { itemId, fileType: "SUBTITLE", isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.itemFile.update({
          where: { id: changes.primarySubtitleId },
          data: { isPrimary: true },
        });
      }
    });

    // Revalidate pages to reflect changes
    revalidatePath("/u", "layout");

    return { success: true };
  } catch {
    return { success: false, error: "Failed to update item settings" };
  }
}

/**
 * Deletes an ItemFile from the database and optionally from Google Drive.
 * If the file has a driveFileId and the item has a Drive connection,
 * also deletes from Google Drive (async, non-blocking).
 *
 * @param fileId - The ID of the ItemFile to delete
 * @returns Success or error result
 *
 * @example
 * const result = await deleteItemFile("file-123");
 * if (result.success) {
 *   // File deleted
 * }
 */
export async function deleteItemFile(fileId: string): Promise<ItemFileResult> {
  // Run rate limit and auth in parallel (async-parallel pattern)
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemDelete"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { success: false, error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Fetch file with item and connection info
    const file = await prisma.itemFile.findUnique({
      where: { id: fileId },
      include: {
        item: {
          select: {
            userId: true,
            driveConnection: { select: { id: true } },
          },
        },
      },
    });

    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (file.item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    // Delete from database
    await prisma.itemFile.delete({
      where: { id: fileId },
    });

    // If file is synced to Drive and connection exists, delete from Drive (async)
    if (file.driveFileId && file.item.driveConnection) {
      deleteFileFromDrive(file.driveFileId).catch((err) => {
        logger.error(
          { err, fileId, driveFileId: file.driveFileId },
          "[deleteItemFile] Failed to delete from Drive"
        );
      });
    }

    // Revalidate to reflect changes
    revalidatePath("/u", "layout");

    return { success: true };
  } catch (err) {
    logger.error({ err, fileId }, "[deleteItemFile] Database error");
    return { success: false, error: "Failed to delete file" };
  }
}
