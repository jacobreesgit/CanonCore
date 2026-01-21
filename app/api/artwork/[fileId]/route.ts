/**
 * Artwork streaming endpoint.
 * Fetches artwork from Google Drive.
 * Supports both authenticated (owner) and public access for fully public items.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveClient, withRateLimit } from "@/lib/google-drive-client";
import { logger } from "@/lib/logger";
import { isItemFullyPublic } from "@/lib/public-auth";

/** Cache artwork for 1 hour (immutable content) */
const CACHE_MAX_AGE = 3600;

/**
 * Converts a Node.js readable stream to a Web ReadableStream.
 * Handles race conditions where data events may fire after close/error.
 *
 * @param nodeStream - Node.js readable stream
 * @returns Web ReadableStream of Uint8Array chunks
 */
function nodeStreamToWeb(
  nodeStream: NodeJS.ReadableStream
): ReadableStream<Uint8Array> {
  let closed = false;

  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => {
        if (!closed) {
          controller.enqueue(new Uint8Array(chunk));
        }
      });
      nodeStream.on("end", () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
      nodeStream.on("error", (err: Error) => {
        if (!closed) {
          closed = true;
          controller.error(err);
        }
      });
    },
    cancel() {
      closed = true;
      // Destroy the node stream if it supports it
      if ("destroy" in nodeStream && typeof nodeStream.destroy === "function") {
        nodeStream.destroy();
      }
    },
  });
}

/**
 * Downloads artwork file via Google Drive and serves to client.
 * Returns image with appropriate caching headers.
 * Allows public access for artwork belonging to fully public items.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Start auth early but await late to prevent waterfall (async-api-routes pattern)
    const sessionPromise = auth();
    const { fileId } = await params;

    // Get ItemFile with Item and Drive connection
    const itemFile = await prisma.itemFile.findUnique({
      where: { id: fileId },
      include: {
        item: {
          include: {
            driveConnection: true,
          },
        },
      },
    });

    if (!itemFile) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Check if item is fully public (allows unauthenticated access)
    const isPublic = await isItemFullyPublic(itemFile.item.id);

    if (!isPublic) {
      // Not public: require authentication and ownership
      const session = await sessionPromise;
      if (!session?.user?.id) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      if (itemFile.item.userId !== session.user.id) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    // Verify file is artwork type
    if (itemFile.fileType !== "ARTWORK") {
      return new NextResponse("Not an artwork file", { status: 400 });
    }

    // Require Google Drive connection and file ID
    if (!itemFile.driveFileId || !itemFile.item.driveConnection) {
      return new NextResponse("No storage connection for file", {
        status: 404,
      });
    }

    const driveConnection = itemFile.item.driveConnection;

    if (driveConnection.needsReauth) {
      return new NextResponse("Reconnect Google Drive", { status: 401 });
    }

    try {
      const drive = await getDriveClient(driveConnection);

      const response = await withRateLimit(() =>
        drive.files.get(
          { fileId: itemFile.driveFileId!, alt: "media" },
          { responseType: "stream" }
        )
      );

      // Convert Node.js stream to Web stream
      const webStream = nodeStreamToWeb(
        response.data as unknown as NodeJS.ReadableStream
      );

      return new NextResponse(webStream, {
        headers: {
          "Content-Type": itemFile.mimeType || "image/jpeg",
          // Public items can be cached by CDN; private items are user-specific
          "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${CACHE_MAX_AGE}`,
        },
      });
    } catch (error) {
      logger.error({ err: error }, "[Artwork] Google Drive fetch error");
      return new NextResponse("Failed to fetch artwork", { status: 500 });
    }
  } catch (error) {
    logger.error({ err: error }, "[Artwork] Error");
    return new NextResponse("Internal server error", { status: 500 });
  }
}
