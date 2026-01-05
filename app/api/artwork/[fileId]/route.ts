/**
 * SFTP artwork download route.
 * Downloads artwork files via SFTP for thumbnail display.
 * Unlike /api/stream, does not require WebDAV - uses direct SFTP download.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadFileBuffer } from "@/lib/sftp-client";
import { isValidPath } from "@/lib/sftp-utils";

/** Cache artwork for 1 hour (immutable content) */
const CACHE_MAX_AGE = 3600;

/** Maximum artwork file size (10MB) to prevent memory issues */
const MAX_ARTWORK_SIZE = 10 * 1024 * 1024;

/**
 * Downloads artwork file via SFTP and serves to client.
 * Returns image with appropriate caching headers.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fileId } = await params;

    // Get ItemFile with Item and Connection
    const itemFile = await prisma.itemFile.findUnique({
      where: { id: fileId },
      include: {
        item: {
          include: {
            connection: true,
          },
        },
      },
    });

    if (!itemFile) {
      return new NextResponse("File not found", { status: 404 });
    }

    // Verify ownership
    if (itemFile.item.userId !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Verify file is artwork type
    if (itemFile.fileType !== "ARTWORK") {
      return new NextResponse("Not an artwork file", { status: 400 });
    }

    // Require SFTP connection
    const connection = itemFile.item.connection;
    if (!connection) {
      return new NextResponse("No connection configured", { status: 501 });
    }

    // Validate path security (prevent traversal attacks)
    if (!isValidPath(itemFile.sftpPath)) {
      console.error("[Artwork] Invalid path:", itemFile.sftpPath);
      return new NextResponse("Invalid file path", { status: 400 });
    }

    // Check file size if known (prevent memory exhaustion)
    if (itemFile.size && Number(itemFile.size) > MAX_ARTWORK_SIZE) {
      console.error("[Artwork] File too large:", itemFile.size);
      return new NextResponse("File too large", { status: 413 });
    }

    // Download via SFTP
    let buffer: Buffer;
    try {
      buffer = await downloadFileBuffer(connection, itemFile.sftpPath);
    } catch (sftpError) {
      const message = sftpError instanceof Error ? sftpError.message : "";

      // Handle specific SFTP errors
      if (message.includes("No such file") || message.includes("not found")) {
        console.error("[Artwork] File not found on SFTP:", itemFile.sftpPath);
        return new NextResponse("File not found on server", { status: 404 });
      }
      if (message.includes("Permission denied")) {
        console.error("[Artwork] Permission denied:", itemFile.sftpPath);
        return new NextResponse("Access denied", { status: 403 });
      }
      if (message.includes("timeout") || message.includes("Timeout")) {
        console.error("[Artwork] Connection timeout");
        return new NextResponse("Connection timeout", { status: 504 });
      }

      // Generic SFTP error
      console.error("[Artwork] SFTP error:", sftpError);
      return new NextResponse("Connection failed", { status: 502 });
    }

    // Verify downloaded size
    if (buffer.length > MAX_ARTWORK_SIZE) {
      console.error("[Artwork] Downloaded file too large:", buffer.length);
      return new NextResponse("File too large", { status: 413 });
    }

    // Build response with caching
    const headers = new Headers();
    headers.set("Content-Type", itemFile.mimeType ?? "image/jpeg");
    headers.set("Content-Length", buffer.length.toString());
    headers.set(
      "Cache-Control",
      `private, max-age=${CACHE_MAX_AGE}, immutable`
    );

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  } catch (error) {
    console.error("[Artwork] Error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
