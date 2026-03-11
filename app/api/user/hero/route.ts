/**
 * API route for serving user hero banner images.
 * Supports both authenticated users and public profiles.
 * Returns binary image data with caching headers.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Serves a user's hero banner image.
 * - No query param: serves authenticated user's hero
 * - ?userId=xxx: serves public profile's hero (only if profile is public)
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

  // Helper to return hero image response with caching headers
  function heroResponse(image: Uint8Array, mime: string) {
    const imageBytes = new Uint8Array(image);
    const etag = createHash("md5").update(imageBytes).digest("hex");
    return new Response(imageBytes, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=3600",
        ETag: `"${etag}"`,
      },
    });
  }

  if (requestedUserId) {
    // Check if user is requesting their own hero (for authenticated users)
    const session = await auth();
    const isOwnHero = session?.user?.id === requestedUserId;

    const user = isOwnHero
      ? await prisma.user.findUnique({
          where: { id: requestedUserId },
          select: { heroImage: true, heroImageMime: true },
        })
      : await prisma.user.findUnique({
          where: { id: requestedUserId, isPublic: true },
          select: { heroImage: true, heroImageMime: true },
        });

    if (!user?.heroImage || !user.heroImageMime) {
      return NextResponse.json(
        { error: "Hero image not found" },
        { status: 404 }
      );
    }

    return heroResponse(user.heroImage, user.heroImageMime);
  }

  // Authenticated user request (legacy path without userId)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { heroImage: true, heroImageMime: true },
  });

  if (!user?.heroImage || !user.heroImageMime) {
    return NextResponse.json(
      { error: "Hero image not found" },
      { status: 404 }
    );
  }

  return heroResponse(user.heroImage, user.heroImageMime);
}
