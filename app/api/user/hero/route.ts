/**
 * API route for serving the authenticated user's hero banner image.
 * Returns binary image data with caching headers.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

/**
 * Serves the authenticated user's hero banner image.
 * Gets userId from session to prevent enumeration attacks.
 *
 * @returns Binary image response with caching headers, or 404/401
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(null, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
