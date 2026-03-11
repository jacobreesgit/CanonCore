/**
 * Cached Google Drive data-fetching functions for server components.
 * Uses React.cache() for per-request deduplication — layout and page
 * components that both need Drive connection data share one DB query.
 *
 * For mutations (connect, disconnect, sync), use google-drive-actions.ts.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Gets the user's Google Drive connection, deduplicated per request.
 * Returns null if not authenticated or no connection exists.
 */
export const getCachedGoogleDriveConnection = cache(async () => {
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
});
