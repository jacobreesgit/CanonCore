/**
 * API route for serving user hero banner images.
 * Supports both authenticated users and public profiles.
 * Returns binary image data with caching headers.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

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

  let userId: string;

  if (requestedUserId) {
    // Check if user is requesting their own hero (for authenticated users)
    const session = await auth();
    const isOwnHero = session?.user?.id === requestedUserId;

    if (!isOwnHero) {
      // Public profile request - verify user is public
      const publicUser = await prisma.user.findUnique({
        where: { id: requestedUserId, isPublic: true },
        select: { id: true },
      });

      if (!publicUser) {
        return new Response(null, { status: 404 });
      }
    }

    userId = requestedUserId;
  } else {
    // Authenticated user request (legacy path without userId)
    const session = await auth();
    if (!session?.user?.id) {
      return new Response(null, { status: 401 });
    }
    userId = session.user.id;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { heroImage: true, heroImageMime: true },
  });

  if (!user?.heroImage || !user.heroImageMime) {
    return new Response(null, { status: 404 });
  }

  // Generate ETag from image content hash
  const etag = createHash("md5").update(user.heroImage).digest("hex");

  return new Response(user.heroImage, {
    status: 200,
    headers: {
      "Content-Type": user.heroImageMime,
      "Cache-Control": "public, max-age=3600",
      ETag: `"${etag}"`,
    },
  });
}
