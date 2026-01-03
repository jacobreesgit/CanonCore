/**
 * Download route for ItemFile.
 * Proxies download through WebDAV with Content-Disposition header.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptCredential } from "@/lib/crypto";
import { buildWebDavUrl, isValidWebDavPath } from "@/lib/webdav-utils";

/** Timeout for WebDAV requests (60 seconds for downloads) */
const DOWNLOAD_TIMEOUT = 60000;

/**
 * Downloads a file from WebDAV server to client.
 * Sets Content-Disposition header to trigger browser download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Verify user owns the item
    if (itemFile.item.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check WebDAV configuration
    const connection = itemFile.item.connection;
    if (!connection?.webdavUrl) {
      return NextResponse.json(
        { error: "Download not available" },
        { status: 502 }
      );
    }

    // Validate path security
    if (!isValidWebDavPath(itemFile.sftpPath)) {
      console.error("[Download] Invalid path detected:", itemFile.sftpPath);
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
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

    // Fetch from WebDAV server with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    try {
      const response = await fetch(webdavUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle WebDAV errors
      if (response.status === 401) {
        console.error("[Download] WebDAV authentication failed");
        return NextResponse.json(
          { error: "Download unavailable" },
          { status: 502 }
        );
      }

      if (response.status === 404) {
        console.error("[Download] File not found on WebDAV:", webdavUrl);
        return NextResponse.json(
          { error: "File not found on server" },
          { status: 404 }
        );
      }

      if (!response.ok) {
        console.error("[Download] WebDAV error:", response.status);
        return NextResponse.json({ error: "Download failed" }, { status: 502 });
      }

      // Build response headers
      const responseHeaders = new Headers();

      // Set content type
      responseHeaders.set(
        "Content-Type",
        itemFile.mimeType ?? "application/octet-stream"
      );

      // Set Content-Disposition to trigger download with proper filename
      const safeFilename = itemFile.filename.replace(/[^\w.-]/g, "_");
      responseHeaders.set(
        "Content-Disposition",
        `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(itemFile.filename)}`
      );

      // Forward content length if available
      const contentLength = response.headers.get("Content-Length");
      if (contentLength) {
        responseHeaders.set("Content-Length", contentLength);
      }

      // Disable caching for downloads
      responseHeaders.set("Cache-Control", "no-store");

      // Stream the response body
      return new NextResponse(response.body, {
        status: 200,
        headers: responseHeaders,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("[Download] Request timeout");
        return NextResponse.json(
          { error: "Download timeout" },
          { status: 504 }
        );
      }

      throw fetchError;
    }
  } catch (error) {
    console.error("[Download] Error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
