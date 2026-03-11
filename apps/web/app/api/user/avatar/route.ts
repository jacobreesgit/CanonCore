/**
 * API route for serving user avatar images.
 * Supports both authenticated users and public profiles.
 * Returns binary image data with caching headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Serves a user's profile image.
 * - No query param: serves authenticated user's avatar
 * - ?userId=xxx: serves public profile's avatar (only if profile is public)
 *
 * @returns Binary image response with caching headers, or 404/401
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const requestedUserId = searchParams.get("userId");

  // Rate limit API access
  const rateLimitResult = await checkRateLimit("apiRoute");
  if (rateLimitResult) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (requestedUserId) {
    // Public profile request - single query combining public check + image fetch
    const user = await prisma.user.findUnique({
      where: { id: requestedUserId, isPublic: true },
      select: { image: true, imageMime: true },
    });

    if (!user?.image || !user.imageMime) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    const imageBytes = new Uint8Array(user.image);
    const etag = createHash("md5").update(imageBytes).digest("hex");
    return new Response(imageBytes, {
      status: 200,
      headers: {
        "Content-Type": user.imageMime,
        "Cache-Control": "public, max-age=3600",
        ETag: `"${etag}"`,
      },
    });
  }

  // Authenticated user request
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { image: true, imageMime: true },
  });

  if (!user?.image || !user.imageMime) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  // Generate ETag from image content hash
  const imageBytes = new Uint8Array(user.image);
  const etag = createHash("md5").update(imageBytes).digest("hex");

  return new Response(imageBytes, {
    status: 200,
    headers: {
      "Content-Type": user.imageMime,
      "Cache-Control": "public, max-age=3600",
      ETag: `"${etag}"`,
    },
  });
}
