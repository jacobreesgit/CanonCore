/**
 * Media streaming endpoint with Range header support.
 * Streams from Google Drive.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveClient, withRateLimit } from "@/lib/google-drive-client";
import { getMimeTypeByExtension } from "@/lib/file-type-utils";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { nodeStreamToWeb } from "@/lib/stream-utils";

/**
 * Parses HTTP Range header for partial content requests.
 *
 * @param range - The Range header value
 * @param fileSize - Total file size in bytes
 * @returns Parsed start and end positions, or null if invalid
 */
function parseRangeHeader(
  range: string,
  fileSize: number
): { start: number; end: number } | null {
  if (!range.startsWith("bytes=")) {
    return null;
  }

  const rangeValue = range.slice(6);
  const [startStr, endStr] = rangeValue.split("-");

  const start = parseInt(startStr, 10);

  if (isNaN(start) || start < 0 || start >= fileSize) {
    return null;
  }

  let end: number;
  if (endStr && endStr.length > 0) {
    end = parseInt(endStr, 10);
    if (isNaN(end) || end < start) {
      return null;
    }
  } else {
    // Default to 10MB chunks for streaming
    end = Math.min(start + 10 * 1024 * 1024 - 1, fileSize - 1);
  }

  end = Math.min(end, fileSize - 1);

  return { start, end };
}

/**
 * Streams a file from Google Drive to client.
 * Supports HTTP range requests for video seeking.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Rate limit API access
    const rateLimitResult = await checkRateLimit("apiRoute");
    if (rateLimitResult) {
      return new NextResponse("Too many requests", { status: 429 });
    }

    // Start auth and params in parallel (async-api-routes pattern)
    const [session, { fileId }] = await Promise.all([auth(), params]);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get ItemFile with its Item and Drive connection
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

    // Verify user owns the item
    if (itemFile.item.userId !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
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
      const fileSize = Number(itemFile.size) || 0;
      // Prioritize filename inference over database value (more reliable)
      const inferredMimeType = getMimeTypeByExtension(itemFile.filename);
      const mimeType =
        inferredMimeType || itemFile.mimeType || "application/octet-stream";

      const range = request.headers.get("range");

      // Handle Range request for seeking
      // If fileSize unknown (0), skip range handling and stream full file
      // This ensures playback works even before size is captured during sync
      if (range && fileSize > 0) {
        const parsed = parseRangeHeader(range, fileSize);

        if (!parsed) {
          return new NextResponse("Invalid Range header", {
            status: 416,
            headers: {
              "Content-Range": `bytes */${fileSize}`,
            },
          });
        }

        const { start, end } = parsed;

        const response = await withRateLimit(() =>
          drive.files.get(
            { fileId: itemFile.driveFileId!, alt: "media" },
            {
              responseType: "stream",
              headers: { Range: `bytes=${start}-${end}` },
            }
          )
        );

        const webStream = nodeStreamToWeb(
          response.data as unknown as NodeJS.ReadableStream
        );

        return new NextResponse(webStream, {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(end - start + 1),
            "Cache-Control":
              "private, max-age=3600, stale-while-revalidate=604800",
          },
        });
      }

      // Full file download (no Range header or unknown size)
      const response = await withRateLimit(() =>
        drive.files.get(
          { fileId: itemFile.driveFileId!, alt: "media" },
          { responseType: "stream" }
        )
      );

      const webStream = nodeStreamToWeb(
        response.data as unknown as NodeJS.ReadableStream
      );

      const headers: Record<string, string> = {
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=604800",
      };
      if (fileSize > 0) {
        headers["Content-Length"] = String(fileSize);
      }

      return new NextResponse(webStream, { headers });
    } catch (error) {
      logger.error({ err: error }, "[Stream] Google Drive error");
      return new NextResponse("Failed to stream file", { status: 500 });
    }
  } catch (error) {
    logger.error({ err: error }, "[Stream] Error");
    return new NextResponse("Internal server error", { status: 500 });
  }
}
