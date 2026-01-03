/**
 * Server actions for ItemFile operations.
 * Handles playback progress and file metadata updates.
 */

"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ItemFile } from "@/lib/types";

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

/** ItemFiles grouped by type */
interface GroupedItemFiles {
  media: ItemFile[];
  artwork: ItemFile[];
  subtitles: ItemFile[];
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
      orderBy: { filename: "asc" },
    });

    // Group by file type
    const grouped: GroupedItemFiles = {
      media: files.filter((f) => f.fileType === "MEDIA"),
      artwork: files.filter((f) => f.fileType === "ARTWORK"),
      subtitles: files.filter((f) => f.fileType === "SUBTITLE"),
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
 * @returns The ItemFile if found and owned by user
 */
export async function getItemFile(
  fileId: string
): Promise<ItemFileResult<ItemFile>> {
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
    return { success: true, data: fileWithoutItem };
  } catch {
    return { success: false, error: "Failed to load file" };
  }
}
