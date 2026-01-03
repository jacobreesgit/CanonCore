/**
 * Server actions for ItemFile operations.
 * Handles playback progress, file metadata, and primary file selection.
 */

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeItemFile } from "@/lib/types";
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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify ownership
    const file = await prisma.itemFile.findUnique({
      where: { id: fileId },
      include: { item: true },
    });

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
      orderBy: [{ isPrimary: "desc" }, { filename: "asc" }],
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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const file = await prisma.itemFile.findUnique({
      where: { id: fileId },
      include: { item: true },
    });

    if (!file) {
      return { success: false, error: "File not found" };
    }

    if (file.item.userId !== session.user.id) {
      return { success: false, error: "Access denied" };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { item, ...fileWithoutItem } = file;
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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const file = await prisma.itemFile.findUnique({
      where: { id: fileId },
      include: { item: true },
    });

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
    revalidatePath("/dashboard", "layout");

    return { success: true };
  } catch {
    return { success: false, error: "Failed to set primary file" };
  }
}
