/**
 * API route for serving playlist artwork images.
 * Supports public playlists, unlisted (share token), and owner access.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const playlistId = searchParams.get("playlistId");
  const token = searchParams.get("token");

  if (!playlistId) {
    return new Response("Missing playlistId", { status: 400 });
  }

  const rateLimitResult = await checkRateLimit("apiRoute");
  if (rateLimitResult) {
    return new Response("Too many requests", { status: 429 });
  }

  const session = await auth();

  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: {
      artworkImage: true,
      artworkMime: true,
      isPublic: true,
      shareToken: true,
      userId: true,
    },
  });

  if (!playlist?.artworkImage || !playlist.artworkMime) {
    return new Response(null, { status: 404 });
  }

  // Access control: public, owner, or valid share token
  const isOwner = session?.user?.id === playlist.userId;
  const isPublic = playlist.isPublic;
  const hasValidToken = token && playlist.shareToken === token;

  if (!isPublic && !isOwner && !hasValidToken) {
    return new Response(null, { status: 404 });
  }

  const imageBytes = new Uint8Array(playlist.artworkImage);
  const etag = createHash("md5").update(imageBytes).digest("hex");

  return new Response(imageBytes, {
    status: 200,
    headers: {
      "Content-Type": playlist.artworkMime,
      "Cache-Control": isPublic
        ? "public, max-age=3600"
        : "private, max-age=3600",
      ETag: `"${etag}"`,
    },
  });
}
