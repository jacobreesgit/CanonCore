/**
 * API route for downloading files from SFTP.
 * Streams file content with proper headers for browser download.
 */

import { NextRequest, NextResponse } from "next/server";
import { downloadFromSftp } from "@/lib/sftp-actions";

/**
 * GET /api/sftp/download/[itemId]
 * Downloads a file from SFTP server.
 *
 * @param request - Next.js request
 * @param params - Route parameters containing itemId
 * @returns File download response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;

    if (!itemId) {
      return NextResponse.json(
        { error: "Item ID is required" },
        { status: 400 }
      );
    }

    const result = await downloadFromSftp(itemId);

    if (!result.success) {
      const status = result.error === "Item not found" ? 404 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    const { buffer, name, mimeType } = result.data!;

    // Set headers for file download
    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(name)}"`
    );
    headers.set("Content-Length", buffer.length.toString());

    // Convert Buffer to Uint8Array for Response compatibility
    const uint8Array = new Uint8Array(buffer);

    return new NextResponse(uint8Array, { headers });
  } catch (error) {
    console.error("[API] Download error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
