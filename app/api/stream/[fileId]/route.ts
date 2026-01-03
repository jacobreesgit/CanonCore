/**
 * WebDAV streaming proxy route.
 * Proxies media files from WebDAV server with range request support.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/crypto";
import { buildWebDavUrl, isValidWebDavPath } from "@/lib/webdav-utils";

/** Timeout for WebDAV requests (30 seconds) */
const WEBDAV_TIMEOUT = 30000;

/**
 * Streams a file from WebDAV server to client.
 * Supports HTTP range requests for video seeking.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fileId } = await params;

    // Get ItemFile with its Item and Connection
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

    // Verify user owns the item
    if (itemFile.item.userId !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Check WebDAV configuration
    const connection = itemFile.item.connection;
    if (!connection?.webdavUrl) {
      return new NextResponse("Streaming not configured", { status: 501 });
    }

    // Validate path security
    if (!isValidWebDavPath(itemFile.sftpPath)) {
      console.error("[Stream] Invalid path detected:", itemFile.sftpPath);
      return new NextResponse("Invalid file path", { status: 400 });
    }

    // Build WebDAV URL
    const webdavUrl = buildWebDavUrl(connection.webdavUrl, itemFile.sftpPath);

    // Prepare headers for WebDAV request
    const headers: HeadersInit = {};

    // Add WebDAV authentication if configured
    if (connection.webdavUsername && connection.encryptedWebdavPassword) {
      const password = decryptCredential(connection.encryptedWebdavPassword);
      const auth = Buffer.from(
        `${connection.webdavUsername}:${password}`
      ).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    // Forward range header for video seeking
    const rangeHeader = request.headers.get("Range");
    if (rangeHeader) {
      headers["Range"] = rangeHeader;
    }

    // Fetch from WebDAV server with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBDAV_TIMEOUT);

    try {
      const response = await fetch(webdavUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle WebDAV errors
      if (response.status === 401) {
        console.error("[Stream] WebDAV authentication failed");
        return new NextResponse("Streaming unavailable", { status: 502 });
      }

      if (response.status === 404) {
        console.error("[Stream] File not found on WebDAV:", webdavUrl);
        return new NextResponse("File not found on server", { status: 404 });
      }

      if (response.status >= 500) {
        console.error("[Stream] WebDAV server error:", response.status);
        return new NextResponse("Server error", {
          status: 502,
          headers: { "Retry-After": "10" },
        });
      }

      if (!response.ok && response.status !== 206) {
        console.error("[Stream] WebDAV error:", response.status);
        return new NextResponse("Failed to stream file", { status: 502 });
      }

      // Build response headers
      const responseHeaders = new Headers();

      // Forward content headers
      const contentType = response.headers.get("Content-Type");
      if (contentType) {
        responseHeaders.set("Content-Type", contentType);
      } else if (itemFile.mimeType) {
        responseHeaders.set("Content-Type", itemFile.mimeType);
      }

      const contentLength = response.headers.get("Content-Length");
      if (contentLength) {
        responseHeaders.set("Content-Length", contentLength);
      }

      const contentRange = response.headers.get("Content-Range");
      if (contentRange) {
        responseHeaders.set("Content-Range", contentRange);
      }

      const acceptRanges = response.headers.get("Accept-Ranges");
      if (acceptRanges) {
        responseHeaders.set("Accept-Ranges", acceptRanges);
      } else {
        responseHeaders.set("Accept-Ranges", "bytes");
      }

      // Set cache headers
      responseHeaders.set("Cache-Control", "private, max-age=3600");

      // Stream the response body
      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[Stream] Request timeout");
        return new NextResponse("Gateway timeout", { status: 504 });
      }

      throw fetchError;
    }
  } catch (error) {
    console.error("[Stream] Error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
